import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiHeader } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { DeviceId } from '../../common/decorators/device-id.decorator';
import { Ip } from '../../common/decorators/ip.decorator';
// import { SmsService } from './sms.service';

@ApiTags('OTP')
@Controller('otp')
export class OtpController {
  constructor(
    private readonly otp: OtpService,
    // private readonly sms: SmsService
  ) {}

  @Post('verify')
  @ApiOperation({
    summary: 'Verify OTP',
    description:
      'Verify OTP code. Requires either email or phone to identify the verification medium. Note: This is a low-level endpoint. Use auth/verify-otp for authentication flow.',
  })
  @ApiHeader({ name: 'x-device-id', required: false, description: 'Device ID (optional)' })
  @ApiHeader({
    name: 'x-forwarded-for',
    required: false,
    description: 'Client IP address (optional, can also be detected automatically)',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid, expired, or already used OTP, or email/phone mismatch',
  })
  async verifyOtp(@Body() dto: VerifyOtpDto, @DeviceId() deviceInfo?: string, @Ip() ip?: string) {
    const result = await this.otp.verifyOtp(
      dto.otpId,
      dto.code,
      deviceInfo,
      ip,
      dto.email,
      dto.phone,
    );
    return { message: 'OTP verified successfully', data: result };
  }

  @Post('resend')
  @ApiOperation({
    summary: 'Resend OTP',
    description:
      'Resend OTP code for phone or email. Supports both login and password reset purposes. Invalidates any existing unused OTPs for the specified purpose and sends a new one.',
  })
  @ApiBody({ type: ResendOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP resent successfully',
    schema: {
      type: 'object',
      properties: {
        otpId: { type: 'string', description: 'New OTP ID for verification' },
        userId: { type: 'string', description: 'User ID' },
        message: { type: 'string', example: 'OTP resent successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request or validation failed' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return await this.otp.resendOtp(dto);
  }
}
