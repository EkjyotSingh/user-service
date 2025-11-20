import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const Ip = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    // Try to get IP from various headers (for proxied requests)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor && typeof forwardedFor === 'string') {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwardedFor.split(',')[0].trim();
    }
    return (
      (request.headers['x-real-ip'] as string | undefined) ||
      (request.headers['x-client-ip'] as string | undefined) ||
      request.ip ||
      request.socket?.remoteAddress ||
      undefined
    );
  },
);
