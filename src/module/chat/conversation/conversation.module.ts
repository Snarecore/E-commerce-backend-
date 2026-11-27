import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../space-module/space-service/space.service';
import { Conversation } from './entities/conversation.entity';
import { ConversationRepository } from './conversation.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([Conversation])
    ],
    controllers: [],
    providers: [ConversationRepository, SpaceService],
    exports: [ConversationRepository]
})

export class ConversationModule {}
