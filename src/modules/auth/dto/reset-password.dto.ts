import {
  IsString,
  IsNotEmpty,
  MinLength,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Custom validator to check if confirmPassword matches newPassword
function Match(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'match',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          return (
            typeof value === 'string' && typeof relatedValue === 'string' && value === relatedValue
          );
        },
        defaultMessage(args: ValidationArguments) {
          return 'Passwords do not match';
        },
      },
    });
  };
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Reset token received from verify password reset OTP',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  resetToken: string;

  @ApiProperty({
    description: 'New password (minimum 6 characters)',
    example: 'NewP@ssw0rd!',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  newPassword: string;

  @ApiProperty({
    description: 'Confirm password (must match new password)',
    example: 'NewP@ssw0rd!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Confirm password is required' })
  @Match('newPassword', { message: 'Passwords do not match' })
  confirmPassword: string;
}
