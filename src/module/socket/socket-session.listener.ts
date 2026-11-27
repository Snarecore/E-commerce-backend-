import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SocketAuthService } from './socket-auth.service';
import { SocketService } from './socket.service';
import { AUTH_SESSION_EVENTS, SessionRevokedEvent } from '../auth/session/auth-session.events';

/**
 * Drops live sockets whose login session has ended (logout, password reset, refresh-token
 * reuse). Each of the user's sockets is re-validated rather than all being dropped, so a
 * logout on one device does not disconnect the user's other devices.
 */
@Injectable()
export class SocketSessionListener {
    private readonly logger = new Logger(SocketSessionListener.name);

    constructor(
        private readonly socketService: SocketService,
        private readonly socketAuthService: SocketAuthService
    ) {}

    @OnEvent(AUTH_SESSION_EVENTS.REVOKED, { async: true })
    async handleSessionRevoked(event: SessionRevokedEvent): Promise<void> {
        try {
            const sockets = await this.socketService.fetchUserSockets(event.userId);
            await Promise.all(
                sockets.map(async (socket) => {
                    const user = socket.data?.user;
                    const active = user
                        ? await this.socketAuthService.isSessionActive(user.sessionId, user.id)
                        : false;
                    if (!active) {
                        socket.disconnect(true);
                        this.logger.log(
                            `Disconnected socket ${socket.id} of user ${event.userId} (${event.reason})`
                        );
                    }
                })
            );
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(
                `Failed to drop revoked sockets for user ${event.userId}: ${err.message}`,
                err.stack
            );
        }
    }
}
