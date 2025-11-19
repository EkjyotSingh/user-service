import { IsString, IsNotEmpty, IsEmail, Matches, ValidateIf, IsEnum, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider } from '../../auth/enums/auth-provider.enum';

export class ResendOtpDto {
  @ApiProperty({
    description: 'OTP purpose - login or reset',
    enum: ['login', 'reset'],
    example: 'login',
  })
  @IsString()
  @IsIn(['login', 'reset'], { message: 'Purpose must be either login or reset' })
  purpose: 'login' | 'reset';

  @ApiProperty({
    description: 'Login type / provider',
    enum: AuthProvider,
    example: AuthProvider.PHONE,
  })
  @IsEnum(AuthProvider)
  type: AuthProvider;

  @ApiProperty({
    description: 'Phone number in E.164 format (required for phone)',
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

  @ApiProperty({
    description: 'Email (required for email type)',
    required: false,
    example: 'alice@example.com',
  })
  @ValidateIf((o) => o.type === AuthProvider.EMAIL)
  @IsNotEmpty({ message: 'Email is required for email login' })
  @IsEmail({}, { message: 'Email is not valid' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;
}
