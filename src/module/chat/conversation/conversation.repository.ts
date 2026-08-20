import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { Conversation } from './entities/conversation.entity';

@Injectable()
export class ConversationRepository extends AbstractRepository<Conversation> {
    constructor(dataSource: DataSource) {
        super(dataSource, Conversation);
    }

    /**
     * Admin messenger inbox — all conversations sorted by lastMessageAt DESC.
     */
    async findAllConversationsPaginated(page = 1, limit = 20): Promise<{
        data: Conversation[];
        total: number;
        page: number;
        limit: number;
        pageCount: number;
    }> {
        const [data, total] = await this.repository
            .createQueryBuilder('conversation')
            .where('conversation.isDeleted = false')
            .andWhere('conversation.customerId != :empty', { empty: '' })
            .orderBy('conversation.lastMessageAt', 'DESC')
            .addOrderBy('conversation.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        const pageCount = Math.ceil(total / limit);
        return { data, total, page, limit, pageCount };
    }

    /**
     * Find active conversation by customerId.
     */
    async findByCustomerId(customerId: string): Promise<Conversation | null> {
        return this.repository.findOne({
            where: { customerId, isDeleted: false }
        });
    }

    /**
     * Atomic increment to avoid race conditions during concurrent messages.
     */
    async incrementUnreadCount(conversationId: string, value = 1): Promise<void> {
        await this.repository.increment({ id: conversationId }, 'unreadCountAdmin', value);
    }
}
