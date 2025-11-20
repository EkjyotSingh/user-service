import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  Matches,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// Custom validator to ensure at least one of email or phone is provided
function IsEmailOrPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEmailOrPhone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as VerifyOtpDto;
          return !!(obj.email || obj.phone);
        },
        defaultMessage(args: ValidationArguments) {
          return 'Either email or phone must be provided';
        },
      },
    });
  };
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'OTP ID received from request OTP',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  otpId: string;

  @ApiProperty({
    description: 'OTP code to verify',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Email address (required if phone is not provided)',
    required: false,
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email is not valid' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @ApiProperty({
    description: 'Phone number in E.164 format (required if email is not provided)',
    required: false,
    example: '+919999999999',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s\-()]/g, '').trim() : value,
  )
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phone must be in E.164 format or digits only' })
  phone?: string;

  @IsEmailOrPhone({ message: 'Either email or phone must be provided' })
  _emailOrPhone?: never; // This field is just for validation, not actually used
}
