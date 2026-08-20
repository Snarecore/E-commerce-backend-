import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from 'src/database/abstract.entity';
import { Role } from 'src/enums/role.enum';

@Entity('messages')
@Index(['conversationId', 'createdAt', 'id'])
export class Message extends AbstractEntity {
    @Column({ type: 'varchar' })
    conversationId: string;

    @Column({ type: 'varchar' })
    senderId: string;

    @Column({ type: 'enum', enum: [Role.CUSTOMER, Role.ADMIN] })
    senderRole: Role.CUSTOMER | Role.ADMIN;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'boolean', default: false })
    isRead: boolean;
}
