import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevokeDto {
  @ApiProperty({
    description: 'Refresh token to revoke',
    example: 'session-id.random-token-string',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
