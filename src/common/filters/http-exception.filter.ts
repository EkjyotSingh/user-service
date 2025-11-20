import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    let message: string;
    let data: any = undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as any;
      if (Array.isArray(responseObj.message)) {
        // Validation errors - array of validation messages
        message = responseObj.message.join(', ');
        data = { errors: responseObj.message };
      } else if (responseObj.message) {
        // Single message string
        message = responseObj.message;
        // Only include data if there are additional fields beyond message and error
        const hasAdditionalFields =
          Object.keys(responseObj).filter(
            (key) => !['message', 'error', 'statusCode'].includes(key),
          ).length > 0;
        if (hasAdditionalFields) {
          const {
            message: _message,
            error: _error,
            statusCode: _statusCode,
            ...rest
          } = responseObj;
          data = rest;
        }
      } else {
        message = exception.message || 'An error occurred';
      }
    } else {
      message = exception.message || 'An error occurred';
    }

    const apiResponse: ApiResponse = {
      success: false,
      statusCode: status,
      message,
      data,
    };

    // Log error for debugging
    this.logger.error(`${request.method} ${request.url} - ${status} - ${message}`, exception.stack);

    response.status(status).json(apiResponse);
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.message : 'Internal server error';

    const apiResponse: ApiResponse = {
      success: false,
      statusCode: status,
      message,
      data: undefined,
    };

    // Log error for debugging
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json(apiResponse);
  }
}
