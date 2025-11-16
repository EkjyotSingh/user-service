import { IsString, IsNotEmpty } from 'class-validator';

export class RevokeDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
