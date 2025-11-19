import { Injectable, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserSession } from './entities/user-session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(UserSession)
    private readonly repo: Repository<UserSession>,
  ) {}

  /**
   * Create a session and return the plain refresh token to send to the user.
   * Token format: "<sessionId>.<randomHex>"
   */
  async createSession(opts: {
    userId: string;
    deviceInfo?: string;
    ip?: string;
    ttlDays?: number;
  }) {
    const { userId, deviceInfo, ip } = opts;
    const ttlDays = opts.ttlDays ?? 30;
    const random = crypto.randomBytes(64).toString('hex'); // random part
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60_000);
    const entity = this.repo.create({
      userId,
      tokenHash: await bcrypt.hash(random, 10),
      deviceId: deviceInfo,
      ip,
      expiresAt,
    });
    const saved = await this.repo.save(entity);
    const plainToken = `${saved.id}.${random}`;
    return { refreshToken: plainToken, expiresAt: saved.expiresAt };
  }

  /**
   * Validate a refresh token and return the session entity if valid.
   * Also checks expiry and returns null if expired.
   */
  async validateRefreshToken(plain: string) {
    const parts = plain.split('.');
    if (parts.length !== 2) throw new BadRequestException('Malformed token');
    const [id, random] = parts;
    const session = await this.repo.findOne({ where: { id } });
    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
      // optionally delete expired session
      await this.repo.delete(session.id);
      return null;
    }
    const ok = await bcrypt.compare(random, session.tokenHash);
    if (!ok) return null;
    return session;
  }

  async revokeById(id: string) {
    return this.repo.delete({ id });
  }

  async revokeByRefreshToken(plain: string) {
    const parts = plain.split('.');
    if (parts.length !== 2) return;
    const [id] = parts;
    await this.repo.delete({ id });
  }

  /**
   * Rotate a refresh token: delete old session and create a new one.
   * Return new token plain string.
   */
  async rotate(sessionId: string, userId: string, deviceInfo?: string, ip?: string) {
    // delete old
    await this.repo.delete({ id: sessionId });
    return this.createSession({ userId, deviceInfo, ip });
  }
}
