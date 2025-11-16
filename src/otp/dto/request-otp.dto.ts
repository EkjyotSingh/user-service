import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsIn(['login', 'reset', 'verify'])
  purpose: 'login' | 'reset' | 'verify';
}
