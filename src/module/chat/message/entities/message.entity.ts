import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { AbstractEntity } from 'src/database/abstract.entity';
import { Role } from 'src/enums/role.enum';

@Entity('messages')
export class Message extends AbstractEntity {
    @Column({ type: 'varchar' })
    senderId: string;

    @Column({ type: 'enum', enum: Role })
    senderRole: Role;

    @Column({ type: 'varchar' })
    receiverId: string;

    @Column({ type: 'enum', enum: Role })
    receiverRole: Role;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'boolean', default: false })
    isRead: boolean;

    @Column({ type: 'varchar' })
    conversationId: string;
}
