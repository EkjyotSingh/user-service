import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { AuthProvider } from './enums/auth-provider.enum';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { OtpService } from 'src/otp/otp.service';
import { SessionService } from 'src/session/session.service';
import * as bcrypt from 'bcrypt';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Main login entry: supports PHONE or EMAIL types
   */
  async login(dto: LoginDto) {
    switch (dto.type) {
      case AuthProvider.PHONE:
        if (!dto.phone) throw new BadRequestException('phone is required');
        return this.loginWithPhone(dto.phone, dto.deviceId, dto.ip);
      case AuthProvider.EMAIL:
        if (!dto.email) throw new BadRequestException('email is required');
        // password may be optional if you want to allow create-without-password
        return this.loginWithEmail(
          dto.email,
          dto.password,
          dto.deviceId,
          dto.ip,
        );
      default:
        throw new UnauthorizedException('Unsupported provider');
    }
  }

  /**
   * Phone-first flow:
   * - normalize phone externally before calling this
   * - ensure user exists (create if not)
   * - create OTP and send via SmsService
   * - return otpId and userId (client will call verifyOtp)
   */
  private async loginWithPhone(
    phone: string,
    deviceInfo?: string,
    ip?: string,
  ) {
    const normalized = this.normalizePhone(phone);
    let user = await this.usersService.findByPhone(normalized);

    if (!user) {
      // create minimal user record; mark provider as phone (or phone_otp depending on your scheme)
      user = await this.usersService.create({
        phone: normalized,
        provider: 'phone_otp',
      } as any);
    }

    // Create OTP (returns { otpId, code } where code is plaintext for sending)
    const { otpId, code } = await this.otpService.createOtp(user.id, 'login');

    // Send OTP (SmsService should implement sendOtp(phone, code, purpose))
    // Wrap in try/catch — if sending fails you may want to invalidate OTP
    try {
      // await this.smsService.sendOtp(normalized, code, 'login');
    } catch (err) {
      // invalidate OTP to be safe
      await this.otpService.invalidateOtp(otpId);
      throw new BadRequestException('Failed to send OTP');
    }

    return { otpId, userId: user.id, message: 'OTP sent' };
  }

  /**
   * Email + password flow:
   * - normalize email
   * - if user doesn't exist: create user (with hashed password if provided)
   * - if user exists: require password and validate
   * - on success: return signed tokens
   */
  private async loginWithEmail(
    email: string,
    password?: string,
    deviceInfo?: string,
    ip?: string,
  ) {
    const normalized = this.normalizeEmail(email);
    let user = await this.usersService.findByEmail(normalized);

    if (!user) {
      // create new user
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      user = await this.usersService.create({
        email: normalized,
        passwordHash,
        provider: password ? 'email_pwd' : 'email_otp', // choose appropriate provider tag
      } as any);

      // If you created user with no password, consider sending verification / onboarding email
      if (!password) {
        // if (this.emailService?.sendWelcome) {
        //   await this.emailService
        //     .sendWelcome(user.email, user.id)
        //     .catch(() => {});
        // }
        // if you want to allow immediate token issuance for created user, you can sign tokens here:
        return this.signTokensForUser(user, deviceInfo, ip);
      }

      // if password was provided and set at creation, sign tokens
      return this.signTokensForUser(user, deviceInfo, ip);
    }

    // existing user: must verify password if stored
    if (!user.password) {
      // no password on user (maybe created via otp previously) -> require password reset or OTP flow
      throw new UnauthorizedException(
        'Password required for this account. Use password reset or email OTP flow.',
      );
    }

    const passwordOk = await bcrypt.compare(password ?? '', user.password);
    if (!passwordOk) throw new UnauthorizedException('Invalid credentials');

    return this.signTokensForUser(user, deviceInfo, ip);
  }

  /**
   * Verify OTP flow: client sends otpId + code (or userId + code depending on your DTO)
   * On success we issue access and refresh tokens.
   */
  async verifyOtp(dto: VerifyOtpDto, deviceInfo?: string, ip?: string) {
    const res = await this.otpService.verifyOtp(dto.otpId, dto.code);
    // res contains { userId, purpose } per OtpService implementation
    const user = await this.usersService.findById(res.userId);
    if (!user) throw new BadRequestException('User not found');

    // If provider was phone_otp and user has no provider set, you may want to update provider
    if (!user.provider || user.provider === AuthProvider.PHONE) {
      await this.usersService
        .update(user.id, { provider: 'phone' } as any)
        .catch(() => {});
    }

    return this.signTokensForUser(user, deviceInfo, ip);
  }

  /**
   * Creates the accessToken (JWT) and refresh token (via SessionService).
   * Assumes SessionService.createSession returns { refreshToken, expiresAt }.
   */
  private async signTokensForUser(
    user: User,
    deviceInfo?: string,
    ip?: string,
  ) {
    // build JWT payload (customize as needed)
    const payload = {
      sub: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      // add minimal claims only
    };

    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: '15m',
    });

    // create refresh session (sessionService returns plain token)
    const { refreshToken, expiresAt } = await this.sessionService.createSession(
      {
        userId: user.id,
        deviceInfo,
        ip,
        ttlDays: 30,
      },
    );

    // Optionally update lastLogin timestamp on user
    try {
      await this.usersService.update(user.id, {
        lastLoginAt: new Date(),
      } as any);
    } catch (e) {
      // ignore update failure — not critical
    }

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
      user: this.stripSensitive(user),
    };
  }

  /* -------------------- helpers -------------------- */

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizePhone(phone: string) {
    // implement E.164 normalization here; placeholder below:
    // prefer using libphonenumber-js in your project
    return phone.replace(/[^\d+]/g, '');
  }

  private stripSensitive(user: User) {
    // remove sensitive props before returning user to client
    // adapt fields according to your User entity
    // clone shallow
    const { passwordHash, ...rest } = user as any;
    return rest;
  }
}
