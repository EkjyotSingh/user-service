import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, SocialLoginDto } from './dto/login.dto';
import { AuthProvider } from './enums/auth-provider.enum';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { OtpService } from 'src/modules/otp/otp.service';
import { SessionService } from 'src/modules/session/session.service';
import * as bcrypt from 'bcrypt';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
    private usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
  ) {
    const gid = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!gid) {
      console.warn('GOOGLE_CLIENT_ID not configured - Google login will fail');
    }
    this.googleClient = new OAuth2Client(gid);
  }

  /**
   * Main login entry: supports PHONE or EMAIL types
   */
  async login(dto: LoginDto, deviceId?: string, ip?: string) {
    switch (dto.type) {
      case AuthProvider.PHONE:
        return this.loginWithPhone(dto.phone!);
      case AuthProvider.EMAIL:
        return this.loginWithEmail(dto.email!, dto.password!, deviceId, ip);
      default:
        throw new UnauthorizedException('Unsupported provider');
    }
  }

  private async loginWithPhone(phone: string) {
    let user = await this.usersService.findByPhone(phone);

    if (!user) {
      user = await this.usersService.create({
        phone: phone,
        provider: AuthProvider.PHONE,
      } as any);
    }

    const { otpId, code } = await this.otpService.createOtp(user.id, 'login');
    console.log('code', code);
    try {
      await this.otpService.addOtpJob({
        phone: phone,
        code,
        purpose: 'login',
        userId: user.id,
        otpId,
      });
    } catch (err) {
      // Invalidate OTP if queueing fails
      await this.otpService.invalidateOtp(otpId);
      throw new BadRequestException('Error in sending OTP, Please try after sometime');
    }

    return { otpId, message: 'OTP sent successfully' };
  }

  /**
   * Email + password flow:
   * - normalize email
   * - if user doesn't exist: create user (with hashed password if provided)
   * - if user exists: require password and validate
   * - on success: return signed tokens
   */
  private async loginWithEmail(email: string, password: string, deviceInfo?: string, ip?: string) {
    let user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      user = await this.usersService.create({
        email,
        password: passwordHash ?? null,
        provider: AuthProvider.EMAIL,
      } as any);
      const { otpId, code } = await this.otpService.createOtp(
        user.id,
        'login',
        this.config.get<number>('OTP_TTL_MINUTES'),
      );

      try {
        await this.otpService.addOtpJob({
          email: email,
          code,
          purpose: 'login',
          userId: user.id,
          otpId,
        });
      } catch (err) {
        // Invalidate OTP if queueing fails
        await this.otpService.invalidateOtp(otpId);
        throw new BadRequestException('Error in sending OTP, Please try after sometime');
      }

      return { otpId, message: 'OTP sent successfully' };
    } else {
      if (!user.isEmailVerified)
        throw new UnauthorizedException('Please verify your email to login');

      const passwordOk = await bcrypt.compare(password ?? '', user.password);
      if (!passwordOk) throw new UnauthorizedException('Invalid credentials');

      return this.signTokensForUser(user, deviceInfo, ip);
    }
  }

  /**
   * Creates the accessToken (JWT) and refresh token (via SessionService).
   * Assumes SessionService.createSession returns { refreshToken, expiresAt, sessionId }.
   * Includes sessionId (jti) in JWT to link token to session for validation.
   */
  async signTokensForUser(user: User, deviceInfo?: string, ip?: string) {
    // Create session first to get session ID
    const { refreshToken, expiresAt, sessionId } = await this.sessionService.createSession({
      userId: user.id,
      deviceInfo,
      ip,
      ttlDays: 30,
    });

    const payload = {
      sub: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      jti: sessionId, // JWT ID - links token to session for validation
    };

    const accessToken = await this.jwt.signAsync(payload);

    try {
      await this.usersService.update(user.id, {
        lastLoginAt: new Date(),
      } as any);
    } catch (e) { }

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
      user: user,
      profileCompletionRequired: !user.profileCompleted,
    };
  }

  /**
   * Logout user - revoke session(s)
   * If refreshToken is provided, revoke only that session
   * Otherwise, revoke all sessions for the user
   */
  async logout(userId: string) {

    // Revoke all sessions for the user
    await this.sessionService.revokeAllByUserId(userId);
    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Complete user profile after first login
   * This is called when a user logs in for the first time and needs to fill out their profile
   */
  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.profileCompleted) {
      throw new BadRequestException('Profile already completed');
    }

    const updateData: any = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      isAdvisor: dto.isAdvisor,
      termsAcceptedAt: new Date(),
      profileCompleted: true,
    };

    if (user.provider === AuthProvider.PHONE) {
      const existingUserByEmail = await this.usersService.findByEmail(dto.email!);
      if (existingUserByEmail && existingUserByEmail.id !== userId) {
        throw new BadRequestException('Email is already registered');
      }
      updateData.email = dto.email;
    } else if (user.provider === AuthProvider.EMAIL || user.provider === AuthProvider.GOOGLE) {
      const existingUserByPhone = await this.usersService.findByPhone(dto.phone!);
      if (existingUserByPhone && existingUserByPhone.id !== userId) {
        throw new BadRequestException('Phone number is already registered');
      }
      updateData.phone = dto.phone;
    }
    // Social login or other providers - allow both updates with uniqueness checks
    else {
      if (dto.email && dto.email !== user.email) {
        const existingUserByEmail = await this.usersService.findByEmail(dto.email);
        if (existingUserByEmail && existingUserByEmail.id !== userId) {
          throw new BadRequestException('Email is already registered');
        }
        updateData.email = dto.email;
      }

      if (dto.phone && dto.phone !== user.phone) {
        const existingUserByPhone = await this.usersService.findByPhone(dto.phone);
        if (existingUserByPhone && existingUserByPhone.id !== userId) {
          throw new BadRequestException('Phone number is already registered');
        }
        updateData.phone = dto.phone;
      }
    }

    // Update user profile
    await this.usersService.update(userId, updateData);

    // Fetch updated user
    const updatedUser = await this.usersService.findById(userId);
    if (!updatedUser) {
      throw new BadRequestException('Failed to update user');
    }

    return {
      message: 'Profile completed successfully',
      user: updatedUser,
    };
  }

  /**
   * Request password reset: validates email exists and user signed up with email provider
   * Sends OTP to user's email
   */
  async requestPasswordReset(email: string) {
    // Find user by email
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists - return success message anyway for security
      return { message: 'If the email exists, a password reset code has been sent.' };
    }

    // Check if user signed up with email provider
    if (user.provider !== AuthProvider.EMAIL) {
      throw new BadRequestException(
        `This email is registered with ${user.provider} provider. Password reset is only available for email-based accounts.`,
      );
    }

    // Create OTP for password reset
    const { otpId, code } = await this.otpService.createOtp(user.id, 'reset', 10); // 10 minutes expiry

    // Add OTP sending job to queue
    try {
      await this.otpService.addOtpJob({
        email: user.email!,
        code,
        purpose: 'reset',
        userId: user.id,
        otpId,
      });
    } catch (err) {
      // Invalidate OTP if queueing fails
      await this.otpService.invalidateOtp(otpId);
      throw new BadRequestException('Failed to queue password reset code for sending');
    }

    // Return otpId (code should be sent via email, not returned)
    return {
      otpId,
      message: 'Password reset code has been sent to your email.',
    };
  }

  /**
   * Verify password reset OTP: validates OTP and returns a reset token
   * This is step 2 of the password reset flow
   */
  async verifyPasswordResetOtp(email: string, otpId: string, code: string) {
    // Verify OTP
    const otpResult: any = await this.otpService.verifyOtp(
      otpId,
      code,
      undefined,
      undefined,
      email,
      undefined,
    );

    // Verify OTP purpose is 'reset'
    if (otpResult?.purpose !== 'reset') {
      throw new BadRequestException('Invalid OTP purpose. This OTP is not for password reset.');
    }

    // Find user by userId from OTP
    const user = await this.usersService.findById(otpResult?.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify email matches
    if (user.email !== email) {
      throw new BadRequestException('Email does not match the OTP recipient');
    }

    // Verify user signed up with email provider
    if (user.provider !== AuthProvider.EMAIL) {
      throw new BadRequestException(
        `This account is registered with ${user.provider} provider. Password reset is only available for email-based accounts.`,
      );
    }

    const now = Math.floor(Date.now() / 1000); // Current time in seconds (JWT iat format)
    const resetToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        purpose: 'password-reset',
        iat: now, // Issued at time - used to invalidate token after password reset
      },
      {
        expiresIn: '15m',
      },
    );

    return {
      resetToken,
      message: 'OTP verified successfully. You can now reset your password.',
    };
  }

  /**
   * Reset password: uses reset token to update user password
   * This is step 3 of the password reset flow
   */
  async resetPassword(resetToken: string, newPassword: string) {
    // Verify and decode reset token
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(resetToken);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Verify token purpose
    if (payload.purpose !== 'password-reset') {
      throw new BadRequestException('Invalid token purpose. This token is not for password reset.');
    }

    // Find user by userId from token
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify user signed up with email provider
    if (user.provider !== AuthProvider.EMAIL) {
      throw new BadRequestException(
        `This account is registered with ${user.provider} provider. Password reset is only available for email-based accounts.`,
      );
    }

    // Verify email matches token
    if (user.email !== payload.email) {
      throw new BadRequestException('Email does not match the reset token');
    }

    // Check if token has already been used (password was reset after token was issued)
    if (user.lastPasswordResetAt && payload.iat) {
      const tokenIssuedAt = new Date(payload.iat * 1000); // Convert seconds to milliseconds
      if (user.lastPasswordResetAt > tokenIssuedAt) {
        throw new BadRequestException(
          'This reset token has already been used. Please request a new password reset.',
        );
      }
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user password and invalidate the token by setting lastPasswordResetAt
    await this.usersService.update(user.id, {
      password: passwordHash,
      lastPasswordResetAt: new Date(),
    } as any);

    return { message: 'Password has been reset successfully.' };
  }

  async socialLogin(dto: SocialLoginDto, deviceId?: string, ip?: string) {
    const { type, idToken } = dto;
    let providerId: string | null = null;
    let email: string | null = null;
    let emailVerified = false;
    let name: string | null = null;
    let picture: string | null = null;

    if (type === AuthProvider.GOOGLE) {
      let ticket;
      try {
        ticket = await this.googleClient.verifyIdToken({
          idToken,
          audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
        });
      } catch (err) {
        console.debug('Google token verify failed', err);
        throw new UnauthorizedException('Invalid Google token');
      }

      const payload = ticket.getPayload();
      if (!payload) throw new UnauthorizedException('Invalid Google token payload');

      providerId = payload['sub'];
      email = payload['email'] ?? null;
      emailVerified = payload['email_verified'] === true;
      name = payload['name'] ?? null;
      picture = payload['picture'] ?? null;

      if (!providerId) {
        throw new UnauthorizedException('Missing provider ID in Google token');
      }
    } else if (type === AuthProvider.APPLE) {
      throw new BadRequestException('Apple login not implemented yet');
    } else {
      throw new BadRequestException('Unsupported social login provider');
    }

    // First, try to find user by providerId
    let user: User | null = null;
    if (providerId) {
      user = await this.users.findByProviderId(type, providerId);
    }

    // If user not found by providerId, check if email already exists
    if (!user && email) {
      const existingUserByEmail = await this.usersService.findByEmail(email);
      if (existingUserByEmail) {
        // If email exists with different provider, throw error
        if (existingUserByEmail.provider !== type) {
          throw new BadRequestException(
            `Email is already linked to another provider (${existingUserByEmail.provider}). Each email can only be linked to one provider.`,
          );
        }
        // Same provider but missing providerId - link it
        await this.usersService.update(existingUserByEmail.id, {
          providerId,
        } as any);
        user = existingUserByEmail;
      }
    }

    // Create new user if still not found
    if (!user) {
      user = await this.users.create({
        name,
        providerId,
        email: email,
        isEmailVerified: emailVerified,
        provider: type,
      } as any);
    } else {
      // Update existing user with latest info
      const updates: any = {};
      if (providerId && !user.providerId) updates.providerId = providerId;
      if (emailVerified && !user.isEmailVerified) updates.isEmailVerified = true;
      if (email && !user.email) {
        updates.email = email;
      }
      if (Object.keys(updates).length > 0) {
        await this.users.update(user.id, updates);
        // Fetch updated user
        user = await this.usersService.findById(user.id);
      }
    }

    // Return tokens
    return this.signTokensForUser(user!, deviceId, ip);
  }
}
