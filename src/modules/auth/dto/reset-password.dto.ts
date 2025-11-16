import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string; // reset token (JWT or OTP style)

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
