import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../../database/abstract.entity';

@Entity('conversations')
@Index(['lastMessageAt', 'customerId'])
export class Conversation extends AbstractEntity {
    @Column({ type: 'varchar', unique: true })
    customerId: string;

    @Column({ type: 'text', nullable: true })
    lastMessage: string | null;

    @Column({ type: 'timestamp', nullable: true })
    lastMessageAt: Date | null;

    @Column({ type: 'int', default: 0 })
    unreadCountAdmin: number;
}
