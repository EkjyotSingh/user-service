import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SessionService } from './session.service';
import { RefreshDto } from './dto/refresh.dto';
import { RevokeDto } from './dto/revoke.dto';

/**
 * Controller provides endpoints for refreshing and revoking tokens.
 * In many apps refresh endpoint is protected by cookie or directly used by client.
 */
@ApiTags('Session')
@Controller('session')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  // @Post('refresh')
  // @ApiOperation({ summary: 'Refresh access token', description: 'Refresh access token using refresh token. Returns new refresh token and expiration.' })
  // @ApiBody({ type: RefreshDto })
  // @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  // @ApiResponse({ status: 200, description: 'Invalid refresh token', schema: { example: { ok: false, message: 'Invalid refresh token' } } })
  // async refresh(@Body() dto: RefreshDto) {
  //   const session = await this.sessions.validateRefreshToken(dto.refreshToken);
  //   if (!session) {
  //     return { ok: false, message: 'Invalid refresh token' };
  //   }
  //   // rotate token: create new one and delete old
  //   const { refreshToken, expiresAt } = await this.sessions.rotate(
  //     session.id,
  //     session.userId,
  //     session.deviceId,
  //     session.ip,
  //   );
  //   return { ok: true, refreshToken, expiresAt };
  // }

  // @Post('revoke')
  // @ApiOperation({ summary: 'Revoke refresh token', description: 'Revoke a refresh token to invalidate the session' })
  // @ApiBody({ type: RevokeDto })
  // @ApiResponse({ status: 200, description: 'Token revoked successfully' })
  // async revoke(@Body() dto: RevokeDto) {
  //   await this.sessions.revokeByRefreshToken(dto.refreshToken);
  //   return { ok: true };
  // }
}
