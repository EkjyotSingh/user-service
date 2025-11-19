import { Body, Controller, Post, Headers, UseGuards, UnauthorizedException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, SocialLoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { VerifyPasswordResetOtpDto } from './dto/verify-password-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeviceId } from '../../common/decorators/device-id.decorator';
import { Ip } from '../../common/decorators/ip.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login with phone or email',
    description: 'Supports phone (OTP) and email/password login',
  })
  @ApiHeader({ name: 'x-device-id', required: false, description: 'Device ID (optional)' })
  @ApiHeader({
    name: 'x-forwarded-for',
    required: false,
    description: 'Client IP address (optional, can also be detected automatically)',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Returns OTP ID for phone login and email login.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @DeviceId() deviceId?: string, @Ip() ip?: string) {
    return await this.authService.login(dto, deviceId, ip);
  }

  @Post('social-login')
  @ApiOperation({
    summary: 'Social login (Google, Apple)',
    description: 'Login using social providers like Google or Apple',
  })
  @ApiHeader({ name: 'x-device-id', required: true, description: 'Device ID' })
  @ApiHeader({
    name: 'x-forwarded-for',
    required: false,
    description: 'Client IP address (optional, can also be detected automatically)',
  })
  @ApiBody({ type: SocialLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Social login successful. Returns access and refresh tokens.',
  })
  @ApiResponse({ status: 401, description: 'Invalid social token' })
  async socialLogin(@Body() dto: SocialLoginDto, @DeviceId() deviceId?: string, @Ip() ip?: string) {
    return await this.authService.socialLogin(dto, deviceId, ip);
  }

  @Post('request-password-reset')
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Request OTP code to reset password for email-based accounts',
  })
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiResponse({ status: 200, description: 'Password reset OTP sent to email' })
  @ApiResponse({ status: 400, description: 'Invalid request or account not found' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return await this.authService.requestPasswordReset(dto.email);
  }

  @Post('verify-password-reset-otp')
  @ApiOperation({
    summary: 'Verify password reset OTP',
    description: 'Verify OTP code for password reset and receive reset token',
  })
  @ApiBody({ type: VerifyPasswordResetOtpDto })
  @ApiResponse({ status: 200, description: 'OTP verified. Returns reset token.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyPasswordResetOtp(@Body() dto: VerifyPasswordResetOtpDto) {
    return await this.authService.verifyPasswordResetOtp(dto.email, dto.otpId, dto.code);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset password using the reset token received from verify-password-reset-otp',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return await this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }

  @Post('complete-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Complete user profile',
    description: 'Complete profile information after first login. Requires authentication.',
  })
  @ApiBody({ type: CompleteProfileDto })
  @ApiResponse({ status: 200, description: 'Profile completed successfully' })
  @ApiResponse({ status: 400, description: 'Profile already completed or validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async completeProfile(@Body() dto: CompleteProfileDto, @CurrentUser() user: User) {
    const userId = user?.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return await this.authService.completeProfile(userId, dto);
  }
}
