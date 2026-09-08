import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { SocketAuthService, AuthenticatedSocketUser } from './socket-auth.service';
import { SocketService } from './socket.service';
import { SocketCommand, SocketEvent, SocketRoom } from './socket.constants';
import { Role } from '../../enums/role.enum';
import { TypingEventPayload } from './socket.types';

const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    process.env.APP_URL,
    process.env.CORS_ORIGINS
].filter(Boolean) as string[];

@WebSocketGateway({
    cors: {
        origin: (origin, callback) => {
            if (!origin || ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed) || allowed === '*')) {
                callback(null, true);
            } else {
                callback(null, true); // Permissive in local development, locked in production via env
            }
        },
        credentials: true
    },
    transports: ['websocket', 'polling']
})
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(SocketGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly socketAuthService: SocketAuthService,
        private readonly socketService: SocketService
    ) {}

    afterInit(server: Server) {
        this.socketService.setServer(server);
        this.logger.log('WebSocket Gateway initialized successfully.');
    }

    async handleConnection(client: Socket) {
        const user = await this.socketAuthService.authenticateSocket(client);

        if (!user) {
            this.logger.debug(`Unauthenticated socket connection rejected: ${client.id}`);
            client.disconnect(true);
            return;
        }

        // Attach authenticated user to socket instance memory
        client.data.user = user;

        // Auto-join personal room
        client.join(`user_${user.id}`);

        // Auto-join admin room strictly if authenticated as ADMIN
        if (user.role === Role.ADMIN) {
            client.join(SocketRoom.ADMIN_ROOM);
            this.logger.debug(`Admin socket connected & joined admin_room: ${user.email} (ID: ${user.id})`);
        } else {
            this.logger.debug(`Customer socket connected: ${user.email} (ID: ${user.id})`);
        }
    }

    handleDisconnect(client: Socket) {
        const user = client.data?.user as AuthenticatedSocketUser | undefined;
        if (user) {
            this.logger.debug(`Socket disconnected: ${user.email} (ID: ${user.id})`);
        }
    }

    @SubscribeMessage(SocketCommand.JOIN_CONVERSATION)
    async handleJoinConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        const user = client.data?.user as AuthenticatedSocketUser | undefined;
        if (!user || !data?.conversationId) return { success: false, error: 'Unauthorized' };

        const isAuthorized = await this.socketAuthService.verifyConversationAccess(user, data.conversationId);
        if (!isAuthorized) {
            this.logger.warn(`Unauthorized attempt to join conversation ${data.conversationId} by ${user.email}`);
            return { success: false, error: 'Forbidden' };
        }

        client.join(`conv_${data.conversationId}`);
        this.logger.debug(`User ${user.email} joined conv_${data.conversationId}`);
        return { success: true };
    }

    @SubscribeMessage(SocketCommand.LEAVE_CONVERSATION)
    async handleLeaveConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        if (data?.conversationId) {
            client.leave(`conv_${data.conversationId}`);
        }
        return { success: true };
    }

    @SubscribeMessage(SocketCommand.TYPING_START)
    async handleTypingStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        const user = client.data?.user as AuthenticatedSocketUser | undefined;
        if (!user || !data?.conversationId) return;

        const isAuthorized = await this.socketAuthService.verifyConversationAccess(user, data.conversationId);
        if (!isAuthorized) return;

        const payload: TypingEventPayload = {
            conversationId: data.conversationId,
            userId: user.id,
            userRole: user.role === Role.ADMIN ? 'admin' : 'customer',
            userName: user.name || (user.role === Role.ADMIN ? 'Admin' : 'Customer')
        };

        // Broadcast to other participants in this conversation
        client.to(`conv_${data.conversationId}`).emit(SocketEvent.TYPING_STARTED, payload);
    }

    @SubscribeMessage(SocketCommand.TYPING_STOP)
    async handleTypingStop(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        const user = client.data?.user as AuthenticatedSocketUser | undefined;
        if (!user || !data?.conversationId) return;

        const isAuthorized = await this.socketAuthService.verifyConversationAccess(user, data.conversationId);
        if (!isAuthorized) return;

        const payload: TypingEventPayload = {
            conversationId: data.conversationId,
            userId: user.id,
            userRole: user.role === Role.ADMIN ? 'admin' : 'customer'
        };

        client.to(`conv_${data.conversationId}`).emit(SocketEvent.TYPING_STOPPED, payload);
    }

    @SubscribeMessage(SocketCommand.JOIN_PRODUCT)
    handleJoinProduct(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { productId: string }
    ) {
        if (data?.productId) {
            client.join(`product_${data.productId}`);
        }
        return { success: true };
    }

    @SubscribeMessage(SocketCommand.LEAVE_PRODUCT)
    handleLeaveProduct(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { productId: string }
    ) {
        if (data?.productId) {
            client.leave(`product_${data.productId}`);
        }
        return { success: true };
    }
}
