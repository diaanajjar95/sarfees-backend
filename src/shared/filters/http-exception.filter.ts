import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Catches every thrown error and renders it in the standard envelope:
 *   { code, message, data }
 *
 * - For HttpException, `code` is the HTTP status and `message` is pulled
 *   from the exception response (string, or { message } shape). Validation
 *   errors (which come through as an array of messages) are preserved inside
 *   `data.errors`.
 * - For anything else, we render a 500 with a generic message so we never
 *   leak internals to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let data: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();

      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object') {
        const obj = resp as Record<string, unknown>;
        if (typeof obj.message === 'string') {
          message = obj.message;
        } else if (Array.isArray(obj.message)) {
          // class-validator / I18nValidationExceptionFilter style
          message = 'Validation failed';
          data = { errors: obj.message };
        } else if (typeof obj.error === 'string') {
          message = obj.error;
        }
      }
    } else {
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    res.status(status).json({ code: status, message, data });
  }
}
