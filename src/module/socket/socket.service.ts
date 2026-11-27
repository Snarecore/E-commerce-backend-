import { Injectable, Logger } from '@nestjs/common';
import { RemoteSocket, Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { SOCKET_ROOMS, SocketEvent } from './socket.constants';
import { SocketData } from './socket.types';

export type UserRemoteSocket = RemoteSocket<DefaultEventsMap, SocketData>;

/**
 * Facade other modules use to push events. Every method is a no-op until the gateway has
 * attached the server (e.g. in serverless runtimes where no socket server exists).
 */
@Injectable()
export class SocketService {
    private readonly logger = new Logger(SocketService.name);
    private server: Server | null = null;

    setServer(server: Server) {
        this.server = server;
        this.logger.log('Socket.IO Server instance attached to SocketService');
    }

    getServer(): Server | null {
        return this.server;
    }

    emitToConversation(conversationId: string, event: SocketEvent, payload: unknown) {
        if (!conversationId) return;
        this.emitToRoom(SOCKET_ROOMS.CONVERSATION(conversationId), event, payload);
    }

    emitToAdmin(event: SocketEvent, payload: unknown) {
        this.emitToRoom(SOCKET_ROOMS.ADMIN_ROOM, event, payload);
    }

    emitToUser(userId: string, event: SocketEvent, payload: unknown) {
        if (!userId) return;
        this.emitToRoom(SOCKET_ROOMS.USER(userId), event, payload);
    }

    emitToProduct(productId: string, event: SocketEvent, payload: unknown) {
        if (!productId) return;
        this.emitToRoom(SOCKET_ROOMS.PRODUCT(productId), event, payload);
    }

    emitToRoom(room: string, event: SocketEvent, payload: unknown) {
        if (!this.server || !room) return;
        this.server.to(room).emit(event, payload);
    }

    broadcast(event: SocketEvent, payload: unknown) {
        if (!this.server) return;
        this.server.emit(event, payload);
    }

    /** Every socket currently connected for a user. */
    async fetchUserSockets(userId: string): Promise<UserRemoteSocket[]> {
        if (!this.server || !userId) return [];
        return (await this.server
            .in(SOCKET_ROOMS.USER(userId))
            .fetchSockets()) as UserRemoteSocket[];
    }
}
