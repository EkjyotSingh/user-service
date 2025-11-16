import {
  IsEnum,
  IsString,
  ValidateIf,
  IsNotEmpty,
  Matches,
  IsEmail,
  IsOptional,
} from 'class-validator';
import { AuthProvider } from '../enums/auth-provider.enum';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Login type / provider',
    enum: AuthProvider,
    example: AuthProvider.PHONE,
  })
  @IsEnum(AuthProvider)
  type: AuthProvider;

  // -------- Phone (required only when type === PHONE) --------
  @ApiProperty({
    description: 'Phone number in E.164 format (required for phone login)',
    required: false,
    example: '+919999999999',
  })
  @ValidateIf((o) => o.type === AuthProvider.PHONE)
  @IsNotEmpty({ message: 'Phone is required' })
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s\-()]/g, '').trim() : value,
  )
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phone must be in E.164 format or digits only' })
  phone?: string;

  // -------- Email (required for email_password) --------
  @ApiProperty({
    description: 'Email (required for email login)',
    required: false,
    example: 'alice@example.com',
  })
  @ValidateIf((o) => o.type === AuthProvider.EMAIL)
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email is not valid' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  // -------- Password (required for email_password) --------
  @ApiProperty({
    description: 'Password (required for email login)',
    required: false,
    example: 'P@ssw0rd!',
  })
  @ValidateIf((o) => o.type === AuthProvider.EMAIL)
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  password?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  ip?: string;
}

export class SocialLoginDto {
  @ApiProperty({
    description: 'Login type / provider',
    enum: AuthProvider,
    example: AuthProvider.GOOGLE,
  })
  @IsNotEmpty()
  @IsEnum(AuthProvider)
  type: AuthProvider;

  @ApiProperty({ description: 'Device ID', example: '12344322' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ description: 'Google ID token from client', example: 'eyJhbGci...' })
  @ValidateIf((o) => o.type === AuthProvider.GOOGLE)
  @IsString()
  idToken: string;
}
