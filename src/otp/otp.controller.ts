import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
// import { SmsService } from './sms.service';

@Controller('otp')
export class OtpController {
  constructor(
    private readonly otp: OtpService,
    // private readonly sms: SmsService
  ) {}

  @Post('request')
  async requestOtp(@Body() dto: RequestOtpDto) {
    // in real app: validate userId exists or create one (AuthService orchestrates)
    const { otpId, code } = await this.otp.createOtp(dto.userId, dto.purpose);
    // send via sms (this SmsService should be provided by you and use provider)
    try {
      //   await this.sms.sendOtp(dto.userId, code, dto.purpose);
    } catch (e) {
      // if sending fails, you might want to delete OTP or mark it invalid
      throw new BadRequestException('Failed to send OTP');
    }
    // return only otpId and a short message — do NOT return plaintext code in production
    return { otpId, message: 'OTP sent' };
  }

  @Post('verify')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const res = await this.otp.verifyOtp(dto.otpId, dto.code);
    return { success: true, ...res };
  }
}
