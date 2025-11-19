import { IsString, IsNotEmpty, IsBoolean, IsEmail, Matches, IsOptional } from 'class-validator';
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

// Custom validator to ensure termsAccepted is true
function IsTrue(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTrue',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return value === true;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Terms of Service must be accepted';
        },
      },
    });
  };
}

export class CompleteProfileDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+919999999999',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s\-()]/g, '').trim() : value,
  )
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phone must be in E.164 format or digits only' })
  phone?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email is not valid' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @ApiProperty({
    description: 'Whether user wants to apply as an advisor',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isAdvisor: boolean;

  @ApiProperty({
    description: 'Terms of Service acceptance (must be true)',
    example: true,
  })
  @IsBoolean()
  @IsTrue({ message: 'Terms of Service must be accepted' })
  termsAccepted: boolean;
}
