import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { Message } from './entities/message.entity';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageRepository } from './message.repository';
import { ConversationRepository } from '../conversation/conversation.repository';
import { UserRepository } from 'src/module/user/user.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([Message])
    ],
    controllers: [MessageController],
    providers: [MessageService, MessageRepository, SpaceService, R2ServiceProvider, ConversationRepository, UserRepository],
    exports: [MessageService, MessageRepository]
})

export class MessageModule {}
