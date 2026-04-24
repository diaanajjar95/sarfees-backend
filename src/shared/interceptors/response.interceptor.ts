import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

/**
 * Wraps every successful controller response in the standard envelope:
 *   { code, message, data }
 *
 * - `code` is the HTTP status code (e.g. 200, 201).
 * - `message` is pulled from the controller return value when the controller
 *   returns `{ message, ...rest }`. The `message` is then stripped from `data`.
 *   Otherwise, a default message based on the status code is used.
 * - `data` is the remainder of the controller return value (or null).
 *
 * Errors are NOT wrapped here; they go through the global exception filter.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiEnvelope<unknown>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<unknown>> {
    const httpCtx = context.switchToHttp();
    const res = httpCtx.getResponse<Response>();

    return next.handle().pipe(
      map((payload) => {
        const statusCode = res.statusCode ?? 200;

        // If the payload is already an envelope, pass it through untouched.
        if (
          payload &&
          typeof payload === 'object' &&
          'code' in (payload as object) &&
          'message' in (payload as object) &&
          'data' in (payload as object)
        ) {
          return payload as unknown as ApiEnvelope<unknown>;
        }

        let message = this.defaultMessageForStatus(statusCode);
        let data: unknown = payload ?? null;

        // If the controller returned an object with a `message` property,
        // lift that out of `data`.
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const obj = payload as Record<string, unknown>;
          if (typeof obj.message === 'string') {
            message = obj.message;
            const rest: Record<string, unknown> = { ...obj };
            delete rest.message;
            data = Object.keys(rest).length > 0 ? rest : null;
          }
        }

        return { code: statusCode, message, data };
      }),
    );
  }

  private defaultMessageForStatus(status: number): string {
    if (status >= 200 && status < 300) return 'Success';
    return 'OK';
  }
}
