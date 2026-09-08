import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { SocketEvent, SocketRoom } from './socket.constants';

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

    emitToConversation(conversationId: string, event: SocketEvent, payload: any) {
        if (!this.server || !conversationId) return;
        this.server.to(`conv_${conversationId}`).emit(event, payload);
    }

    emitToAdmin(event: SocketEvent, payload: any) {
        if (!this.server) return;
        this.server.to(SocketRoom.ADMIN_ROOM).emit(event, payload);
    }

    emitToUser(userId: string, event: SocketEvent, payload: any) {
        if (!this.server || !userId) return;
        this.server.to(`user_${userId}`).emit(event, payload);
    }

    emitToProduct(productId: string, event: SocketEvent, payload: any) {
        if (!this.server || !productId) return;
        this.server.to(`product_${productId}`).emit(event, payload);
    }

    emitToRoom(room: string, event: SocketEvent, payload: any) {
        if (!this.server || !room) return;
        this.server.to(room).emit(event, payload);
    }

    broadcast(event: SocketEvent, payload: any) {
        if (!this.server) return;
        this.server.emit(event, payload);
    }
}
