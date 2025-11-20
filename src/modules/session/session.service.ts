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
  ) { }

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
      isActive: true,
    });
    const saved = await this.repo.save(entity);
    const plainToken = `${saved.id}.${random}`;
    return { refreshToken: plainToken, expiresAt: saved.expiresAt, sessionId: saved.id };
  }

  /**
   * Validate a refresh token and return the session entity if valid.
   * Also checks expiry and active status.
   */
  async validateRefreshToken(plain: string) {
    const parts = plain.split('.');
    if (parts.length !== 2) throw new BadRequestException('Malformed token');
    const [id, random] = parts;
    const session = await this.repo.findOne({ where: { id } });
    if (!session) return null;
    if (!session.isActive) return null; // Session is not active (logged out)
    if (session.expiresAt.getTime() < Date.now()) {
      // optionally delete expired session
      await this.repo.delete(session.id);
      return null;
    }
    const ok = await bcrypt.compare(random, session.tokenHash);
    if (!ok) return null;
    return session;
  }

  /**
   * Check if a session exists and is active
   */
  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.repo.findOne({ where: { id: sessionId } });
    if (!session) return false;
    if (!session.isActive) return false; // Session is not active (logged out)
    if (session.expiresAt.getTime() < Date.now()) {
      // Session expired, mark as inactive
      await this.repo.update(session.id, { isActive: false });
      return false;
    }
    return true;
  }

  async revokeById(id: string) {
    // Mark session as inactive instead of deleting (for audit trail)
    return this.repo.update({ id }, { isActive: false });
  }

  async revokeByRefreshToken(plain: string) {
    const parts = plain.split('.');
    if (parts.length !== 2) return;
    const [id] = parts;
    // Mark session as inactive instead of deleting (for audit trail)
    await this.repo.update({ id }, { isActive: false });
  }

  /**
   * Revoke all sessions for a user (mark as inactive)
   */
  async revokeAllByUserId(userId: string) {
    // Mark all sessions as inactive instead of deleting (for audit trail)
    return this.repo.update({ userId }, { isActive: false });
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
