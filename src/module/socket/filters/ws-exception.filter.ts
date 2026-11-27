import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

/**
 * The HTTP-oriented global ValidationPipe throws BadRequestException, which the default
 * WebSocket filter reports as "Internal server error". This maps any HttpException to a
 * WsException so the client receives the real validation message on the `exception` event.
 */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        if (exception instanceof HttpException) {
            return super.catch(new WsException(exception.getResponse()), host);
        }
        return super.catch(exception, host);
    }
}
