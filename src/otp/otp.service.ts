import { Injectable, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OtpEntity } from './entities/otp.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpEntity)
    private readonly otpRepo: Repository<OtpEntity>,
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
    purpose: OtpEntity['purpose'],
    ttlMinutes = 5,
  ) {
    const code = this.generateNumericOtp(6);
    const codeHash = await bcrypt.hash(code, 10);
    const otp = this.otpRepo.create({
      userId,
      purpose,
      codeHash,
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      used: false,
    });
    const saved = await this.otpRepo.save(otp);
    return { otpId: saved.id, code }; // send code via sms/email from controller
  }

  async verifyOtp(otpId: string, code: string) {
    const otp = await this.otpRepo.findOne({ where: { id: otpId } });
    if (!otp) throw new BadRequestException('Invalid OTP');
    if (otp.used) throw new BadRequestException('OTP already used');
    if (otp.expiresAt.getTime() < Date.now())
      throw new BadRequestException('OTP expired');

    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) throw new BadRequestException('Invalid OTP');

    otp.used = true;
    await this.otpRepo.save(otp);
    return { userId: otp.userId, purpose: otp.purpose };
  }

  async invalidateOtp(otpId: string) {
    await this.otpRepo.update({ id: otpId }, { used: true });
  }

  // For admin/debug only (not exposed in public API)
  async findById(id: string) {
    return this.otpRepo.findOne({ where: { id } });
  }
}
