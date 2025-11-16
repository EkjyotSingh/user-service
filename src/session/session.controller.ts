import { Controller, Post, Body } from '@nestjs/common';
import { SessionService } from './session.service';
import { RefreshDto } from './dto/refresh.dto';
import { RevokeDto } from './dto/revoke.dto';

/**
 * Controller provides endpoints for refreshing and revoking tokens.
 * In many apps refresh endpoint is protected by cookie or directly used by client.
 */
@Controller('session')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    const session = await this.sessions.validateRefreshToken(dto.refreshToken);
    if (!session) {
      return { ok: false, message: 'Invalid refresh token' };
    }
    // rotate token: create new one and delete old
    const { refreshToken, expiresAt } = await this.sessions.rotate(
      session.id,
      session.userId,
      session.deviceId,
      session.ip,
    );
    return { ok: true, refreshToken, expiresAt };
  }

  @Post('revoke')
  async revoke(@Body() dto: RevokeDto) {
    await this.sessions.revokeByRefreshToken(dto.refreshToken);
    return { ok: true };
  }
}
