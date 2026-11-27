import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

/**
 * Last line of the HTTP error path.
 *
 * - HttpExceptions (validation errors, 404s, conflicts, deliberate 5xx with a written message)
 *   are returned exactly as thrown.
 * - Anything else — a database driver error, a TypeError, a third-party SDK failure — is an
 *   unexpected bug: it is logged with its stack and an error id, and the client only gets a
 *   generic message plus that id. Raw driver text (table names, SQL, duplicate-key values)
 *   never reaches a browser.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('UnhandledException');

    catch(exception: unknown, host: ArgumentsHost): void {
        if (host.getType() !== 'http') throw exception;

        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        if (exception instanceof HttpException) {
            const body = exception.getResponse();
            response.status(exception.getStatus()).json(typeof body === 'string' ? { statusCode: exception.getStatus(), message: body } : body);
            return;
        }

        const errorId = randomUUID();
        const err = exception instanceof Error ? exception : new Error(String(exception));
        this.logger.error(`[${errorId}] ${request.method} ${request.originalUrl}: ${err.message}`, err.stack);

        if (response.headersSent) return;
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Something went wrong on our side. Please try again.',
            errorId,
        });
    }
}
