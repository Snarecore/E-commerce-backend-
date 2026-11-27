import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SocketAuthService } from './socket-auth.service';
import { SocketSessionListener } from './socket-session.listener';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { AuthModule } from '../auth/auth.module';
import { ConversationRepository } from '../chat/conversation/conversation.repository';

/**
 * Real-time transport. Global because SocketService is a cross-cutting facade that many
 * feature modules (orders, chat, notifications) push events through.
 */
@Global()
@Module({
    imports: [
        // Only verification happens here; the secret is passed per call (see SocketAuthService)
        JwtModule.register({}),
        AuthModule,
    ],
    providers: [
        SocketGateway,
        SocketService,
        SocketAuthService,
        SocketSessionListener,
        ConversationRepository,
    ],
    exports: [SocketService],
})
export class SocketModule {}
