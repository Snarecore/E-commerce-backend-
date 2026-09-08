import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { SocketAuthService } from './socket-auth.service';
import { Conversation } from '../chat/conversation/entities/conversation.entity';
import { ConversationRepository } from '../chat/conversation/conversation.repository';
import { User } from '../user/entities/user.entity';
import { UserRepository } from '../user/user.repository';

@Global()
@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || '0c1b10e6e5375d9a6fcd5cbf764f7ae83f9a6b91d0b77127c553b0aef4647d89',
            signOptions: { expiresIn: '7d' },
        }),
        TypeOrmModule.forFeature([Conversation, User]),
    ],
    providers: [
        SocketGateway,
        SocketService,
        SocketAuthService,
        ConversationRepository,
        UserRepository
    ],
    exports: [
        SocketService,
        SocketGateway
    ]
})
export class SocketModule {}
