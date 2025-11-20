import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({
    description: 'Refresh token to get new access token',
    example: 'session-id.random-token-string',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
