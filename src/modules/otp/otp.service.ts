import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Otp, OtpPurpose } from './entities/otp.entity';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { AuthProvider } from '../auth/enums/auth-provider.enum';

export interface OtpJobData {
  email?: string;
  phone?: string;
  code: string;
  purpose: 'login' | 'reset' | 'verify';
  userId: string;
  otpId: string;
}

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(Otp)
    private readonly otpRepo: Repository<Otp>,
    @InjectQueue('otp')
    private readonly otpQueue: Queue<OtpJobData>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  private generateNumericOtp(length = 6) {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
  }

  /**
   * Create OTP and return { otpId, code } (plaintext code for sending)
   * Note: caller should call Sms/Email service with code; never return plaintext to end-user in production APIs.
   */
  async createOtp(
    userId: string,
    purpose: Otp['purpose'],
    ttlMinutes = this.configService.get<number>('OTP_TTL_MINUTES'),
  ) {
    const code = this.generateNumericOtp(6);
    const codeHash = await bcrypt.hash(code, 10);
    const otp = this.otpRepo.create({
      userId,
      purpose,
      codeHash,
      expiresAt: new Date(Date.now() + ttlMinutes! * 60_000),
      used: false,
    });
    const saved = await this.otpRepo.save(otp);
    console.log('code', code);
    return { otpId: saved.id, code };
  }

  async verifyOtp(
    otpId: string,
    code: string,
    deviceInfo?: string,
    ip?: string,
    email?: string,
    phone?: string,
  ): Promise<
    | {}
    | {
        accessToken: string;
        refreshToken: string;
        refreshExpiresAt: Date;
        user: User;
        profileCompletionRequired: boolean;
      }
  > {
    const otp = await this.otpRepo.findOne({ where: { id: otpId } });
    if (!otp) throw new BadRequestException('Invalid OTP');
    if (otp.used) throw new BadRequestException('Invalid OTP');
    if (otp.expiresAt.getTime() < Date.now()) throw new BadRequestException('OTP expired');

    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) throw new BadRequestException('Invalid OTP');

    // Fetch user to validate email/phone
    const user = await this.usersService.findById(otp.userId);
    if (!user) throw new BadRequestException('User not found');

    // Validate that the provided email/phone matches the user
    if (email) {
      if (!user.email || user.email.toLowerCase() !== email.toLowerCase()) {
        throw new BadRequestException('Email does not match the OTP recipient');
      }
      user.isEmailVerified = true;
      await this.usersService.update(user.id, { isEmailVerified: true });
    }
    if (phone) {
      // Normalize phone for comparison (remove spaces, dashes, etc.)
      const normalizedPhone = phone.replace(/[\s\-()]/g, '').trim();
      const normalizedUserPhone = user.phone?.replace(/[\s\-()]/g, '').trim();
      if (!normalizedUserPhone || normalizedUserPhone !== normalizedPhone) {
        throw new BadRequestException('Phone does not match the OTP recipient');
      }
      user.isPhoneVerified = true;
      await this.usersService.update(user.id, { isPhoneVerified: true });
    }

    otp.used = true;
    await this.otpRepo.save(otp);

    if (otp.purpose === 'login') {
      return await this.authService.signTokensForUser(user, deviceInfo, ip);
    }
    return { userId: user.id, purpose: otp.purpose };
  }

  async invalidateOtp(otpId: string) {
    await this.otpRepo.update({ id: otpId }, { used: true });
  }

  /**
   * Invalidate all unused OTPs for a user with a specific purpose
   */
  async invalidateUnusedOtpsForUser(userId: string, purpose: OtpPurpose) {
    await this.otpRepo.update({ userId, purpose, used: false }, { used: true });
  }

  // For admin/debug only (not exposed in public API)
  async findById(id: string) {
    return this.otpRepo.findOne({ where: { id } });
  }

  /**
   * Add OTP sending job to queue
   */
  async addOtpJob(data: OtpJobData) {
    return await this.otpQueue.add('send-otp', data, {
      attempts: 3, // Retry 3 times if it fails
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 second delay
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    });
  }

  /**
   * Resend OTP for phone or email (supports both login and reset purposes)
   */
  async resendOtp(dto: ResendOtpDto) {
    let user: User | null = null;

    if (dto.type === AuthProvider.PHONE) {
      user = await this.usersService.findByPhone(dto.phone!);
      if (!user) {
        throw new NotFoundException('User not found with this phone number');
      }
    } else if (dto.type === AuthProvider.EMAIL) {
      user = await this.usersService.findByEmail(dto.email!);
      if (!user) {
        throw new NotFoundException('User not found with this email');
      }
    } else {
      throw new BadRequestException('Unsupported provider for OTP resend');
    }

    // Invalidate existing unused OTPs for this purpose
    await this.invalidateUnusedOtpsForUser(user.id, dto.purpose);

    // Create new OTP
    const { otpId, code } = await this.createOtp(
      user.id,
      dto.purpose,
      this.configService.get<number>('OTP_TTL_MINUTES'),
    );

    // Send OTP via SMS or Email
    try {
      if (dto.type === AuthProvider.PHONE) {
        await this.addOtpJob({
          phone: dto.phone!,
          code,
          purpose: dto.purpose,
          userId: user.id,
          otpId,
        });
      } else if (dto.type === AuthProvider.EMAIL) {
        await this.addOtpJob({
          email: dto.email!,
          code,
          purpose: dto.purpose,
          userId: user.id,
          otpId,
        });
      }
    } catch (err) {
      // Invalidate OTP if queueing fails
      await this.invalidateOtp(otpId);
      throw new BadRequestException('Error in sending OTP, Please try after sometime');
    }

    return { otpId, userId: user.id, message: 'OTP resent successfully' };
  }
}
