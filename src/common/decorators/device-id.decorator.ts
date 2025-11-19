import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const DeviceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const deviceId =
      (request.headers['x-device-id'] as string | undefined) ||
      (request.headers['device-id'] as string | undefined);
    return deviceId || undefined;
  },
);
