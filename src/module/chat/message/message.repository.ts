import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessageRepository extends AbstractRepository<Message> {
    constructor(dataSource: DataSource) {
        super(dataSource, Message);
    }

    /**
     * Deterministic composite cursor-based pagination (createdAt + id) for thread messages.
     * Prevents duplicate/skipped messages if multiple messages share the same millisecond timestamp.
     */
    async getThreadMessages(
        conversationId: string,
        cursor?: string,
        limit = 50
    ): Promise<Message[]> {
        const query = this.repository
            .createQueryBuilder('message')
            .where('message.conversationId = :conversationId', { conversationId })
            .andWhere('message.isDeleted = false');

        if (cursor) {
            const cursorMessage = await this.repository.findOne({
                where: { id: cursor }
            });
            if (cursorMessage) {
                query.andWhere(
                    '(message.createdAt < :cursorCreatedAt OR (message.createdAt = :cursorCreatedAt AND message.id < :cursorId))',
                    {
                        cursorCreatedAt: cursorMessage.createdAt,
                        cursorId: cursorMessage.id
                    }
                );
            }
        }

        const messages = await query
            .orderBy('message.createdAt', 'DESC')
            .addOrderBy('message.id', 'DESC')
            .take(limit)
            .getMany();

        // Reverse so the UI receives oldest → newest (chronological)
        return messages.reverse();
    }
}
