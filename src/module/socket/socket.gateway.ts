import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConversationRoomDto, ProductRoomDto } from './dto/socket-room.dto';
import { WsExceptionFilter } from './filters/ws-exception.filter';
import { SocketAuthService } from './socket-auth.service';
import { SOCKET_ROOMS, SocketCommand, SocketEvent } from './socket.constants';
import { SocketService } from './socket.service';
import { AuthenticatedSocketUser, SocketData, TypingEventPayload } from './socket.types';
import { Role } from '../../enums/role.enum';
import { corsOriginCallback } from '../../utils/cors-origins.util';

type AppSocket = Socket<any, any, any, SocketData>;
type AckResult = { success: true } | { success: false; error: string };

@WebSocketGateway({
    cors: {
        // Same exact-match allow-list as the HTTP API (see main.ts).
        origin: corsOriginCallback,
        credentials: true,
    },
    transports: ['websocket', 'polling'],
})
@UseFilters(new WsExceptionFilter())
@UsePipes(
    new ValidationPipe({
        transform: true,
        whitelist: true,
        exceptionFactory: (errors) =>
            new WsException(errors.flatMap((e) => Object.values(e.constraints ?? {}))),
    })
)
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
        // PM2 numbers workers 0..n-1; any worker above 0 means rooms are split across processes
        if (Number(process.env.NODE_APP_INSTANCE ?? 0) > 0) {
            this.logger.error(
                `Socket.IO is running in PM2 worker #${process.env.NODE_APP_INSTANCE}. Rooms are in-memory, so ` +
                    'events will miss clients connected to other workers. Run a single instance (see ecosystem.config.js).'
            );
        }
        if (process.env.VERCEL) {
            this.logger.warn(
                'Running on Vercel serverless: WebSocket connections are not supported there. ' +
                    'Real-time events are dropped; run the socket server on a long-lived host (PM2/VPS/container).'
            );
        }
        this.logger.log('WebSocket Gateway initialized successfully.');
    }

    async handleConnection(client: AppSocket) {
        const user = await this.socketAuthService.authenticateSocket(client);
        if (!user) {
            this.logger.debug(`Unauthenticated socket connection rejected: ${client.id}`);
            client.disconnect(true);
            return;
        }

        client.data.user = user;
        await client.join(SOCKET_ROOMS.USER(user.id));

        if (user.role === Role.ADMIN) {
            await client.join(SOCKET_ROOMS.ADMIN_ROOM);
            this.logger.debug(
                `Admin socket connected & joined admin_room: ${user.email} (ID: ${user.id})`
            );
        } else {
            this.logger.debug(`Customer socket connected: ${user.email} (ID: ${user.id})`);
        }
    }

    handleDisconnect(client: AppSocket) {
        const user = client.data?.user;
        if (user) {
            this.logger.debug(`Socket disconnected: ${user.email} (ID: ${user.id})`);
        }
    }

    @SubscribeMessage(SocketCommand.JOIN_CONVERSATION)
    async handleJoinConversation(
        @ConnectedSocket() client: AppSocket,
        @MessageBody() { conversationId }: ConversationRoomDto
    ): Promise<AckResult> {
        const user = this.getUser(client);
        if (!user) return { success: false, error: 'Unauthorized' };

        const isAuthorized = await this.socketAuthService.verifyConversationAccess(
            user,
            conversationId
        );
        if (!isAuthorized) {
            this.logger.warn(
                `Unauthorized attempt to join conversation ${conversationId} by ${user.email}`
            );
            return { success: false, error: 'Forbidden' };
        }

        await client.join(SOCKET_ROOMS.CONVERSATION(conversationId));
        this.logger.debug(`User ${user.email} joined ${SOCKET_ROOMS.CONVERSATION(conversationId)}`);
        return { success: true };
    }

    @SubscribeMessage(SocketCommand.LEAVE_CONVERSATION)
    async handleLeaveConversation(
        @ConnectedSocket() client: AppSocket,
        @MessageBody() { conversationId }: ConversationRoomDto
    ): Promise<AckResult> {
        await client.leave(SOCKET_ROOMS.CONVERSATION(conversationId));
        return { success: true };
    }

    @SubscribeMessage(SocketCommand.TYPING_START)
    handleTypingStart(
        @ConnectedSocket() client: AppSocket,
        @MessageBody() { conversationId }: ConversationRoomDto
    ) {
        this.relayTyping(client, conversationId, SocketEvent.TYPING_STARTED);
    }

    @SubscribeMessage(SocketCommand.TYPING_STOP)
    handleTypingStop(
        @ConnectedSocket() client: AppSocket,
        @MessageBody() { conversationId }: ConversationRoomDto
    ) {
        this.relayTyping(client, conversationId, SocketEvent.TYPING_STOPPED);
    }

    @SubscribeMessage(SocketCommand.JOIN_PRODUCT)
    async handleJoinProduct(
        @ConnectedSocket() client: AppSocket,
        @MessageBody() { productId }: ProductRoomDto
    ): Promise<AckResult> {
        await client.join(SOCKET_ROOMS.PRODUCT(productId));
        return { success: true };
    }

    @SubscribeMessage(SocketCommand.LEAVE_PRODUCT)
    async handleLeaveProduct(
        @ConnectedSocket() client: AppSocket,
        @MessageBody() { productId }: ProductRoomDto
    ): Promise<AckResult> {
        await client.leave(SOCKET_ROOMS.PRODUCT(productId));
        return { success: true };
    }

    private getUser(client: AppSocket): AuthenticatedSocketUser | undefined {
        return client.data?.user;
    }

    /**
     * Typing indicators are only relayed for conversations the socket has already joined.
     * Joining runs the access check once, so no DB query is needed per keystroke event.
     */
    private relayTyping(
        client: AppSocket,
        conversationId: string,
        event: SocketEvent.TYPING_STARTED | SocketEvent.TYPING_STOPPED
    ) {
        const user = this.getUser(client);
        const room = SOCKET_ROOMS.CONVERSATION(conversationId);
        if (!user || !client.rooms.has(room)) return;

        const isAdmin = user.role === Role.ADMIN;
        const payload: TypingEventPayload = {
            conversationId,
            userId: user.id,
            userRole: isAdmin ? 'admin' : 'customer',
            ...(event === SocketEvent.TYPING_STARTED && {
                userName: user.name || (isAdmin ? 'Admin' : 'Customer'),
            }),
        };
        client.to(room).emit(event, payload);
    }
}
