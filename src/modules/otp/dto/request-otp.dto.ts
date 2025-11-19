import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({
    description: 'User ID for whom OTP should be generated',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Purpose of the OTP',
    enum: ['login', 'reset', 'verify'],
    example: 'login',
  })
  @IsString()
  @IsIn(['login', 'reset', 'verify'])
  purpose: 'login' | 'reset' | 'verify';
}
