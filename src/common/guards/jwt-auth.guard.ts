import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Optional, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../modules/users/users.service';
import { SessionService } from '../../modules/session/session.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    @Optional()
    @Inject(SessionService)
    private sessionService?: SessionService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authorization token required');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub;
      const sessionId = payload.jti; // JWT ID - session ID from token

      if (!userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Verify session is still active (if sessionId is present and SessionService is available)
      // This ensures tokens are invalidated after logout
      if (sessionId && this.sessionService) {
        const isSessionActive = await this.sessionService.isSessionActive(sessionId);
        if (!isSessionActive) {
          throw new UnauthorizedException('Sesssion expired. Please login again.');
        }
      }

      // Verify user exists in database
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if user is deleted
      if (user.isDeleted) {
        throw new UnauthorizedException('User account has been deleted');
      }

      // Attach full user entity to request
      request.user = user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Sesssion expired. Please login again.');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
