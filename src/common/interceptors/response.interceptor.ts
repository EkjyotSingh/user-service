import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse();
    const statusCode = response.statusCode || HttpStatus.OK;

    return next.handle().pipe(
      map((data) => {
        // If data is already in ApiResponse format, return it as is
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'statusCode' in data &&
          Object.keys(data).length <= 4 // success, statusCode, message, data
        ) {
          return data as ApiResponse<T>;
        }

        // If data is null or undefined
        if (data === null || data === undefined) {
          return {
            success: true,
            statusCode,
            message: 'Success',
            data: undefined,
          };
        }

        // If data is a primitive type (string, number, boolean)
        if (typeof data !== 'object' || Array.isArray(data)) {
          return {
            success: true,
            statusCode,
            message: 'Success',
            data: data as T,
          };
        }

        // If data has a message property, extract it
        if ('message' in data) {
          const { message, ...rest } = data;
          const hasOtherData = Object.keys(rest).length > 0;

          return {
            success: true,
            statusCode,
            message: message || 'Success',
            data: hasOtherData ? (rest as T) : undefined,
          };
        }

        // Default: wrap entire data object
        return {
          success: true,
          statusCode,
          message: 'Success',
          data: data as T,
        };
      }),
    );
  }
}
