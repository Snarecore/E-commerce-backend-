import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { Conversation } from './entities/conversation.entity';

@Injectable()
export class ConversationRepository extends AbstractRepository<Conversation> {
    constructor(dataSource: DataSource) {
        super(dataSource, Conversation);
    }

    // async paginateUserConversations(userId: string, page = 1, limit = 10) {
    //     const [data, total] = await this.repository
    //         .createQueryBuilder('conversation')
    //         .where('conversation.participantOneId = :userId', { userId })
    //         .orWhere('conversation.participantTwoId = :userId', { userId })
    //         .andWhere('conversation.isDeleted = false')
    //         .orderBy('conversation.createdAt', 'DESC')
    //         .skip((page - 1) * limit)
    //         .take(limit)
    //         .getManyAndCount();

    //     const pageCount = Math.ceil(total / limit);

    //     return {
    //         data,
    //         total,
    //         page,
    //         limit,
    //         pageCount
    //     };
    // }

    async findAllUserConversations(userId: string): Promise<Conversation[]> {
        return this.repository
            .createQueryBuilder('conversation')
            .where('conversation.participantOneId = :userId', { userId })
            .orWhere('conversation.participantTwoId = :userId', { userId })
            .andWhere('conversation.isDeleted = false')
            .orderBy('conversation.createdAt', 'DESC')
            .getMany();
    }
}
