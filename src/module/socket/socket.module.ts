import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET,
                signOptions: { expiresIn: '7d' },
            }),
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

