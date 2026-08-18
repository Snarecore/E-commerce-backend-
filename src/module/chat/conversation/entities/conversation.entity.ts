import { Column, Entity } from 'typeorm';
import { AbstractEntity } from 'src/database/abstract.entity';
import { Role } from 'src/enums/role.enum';

@Entity('conversations')
export class Conversation extends AbstractEntity {
    @Column({ type: 'varchar' })
    participantOneId: string;

    @Column({ type: 'enum', enum: Role })
    participantOneRole: Role;

    @Column({ type: 'varchar' })
    participantTwoId: string;

    @Column({ type: 'enum', enum: Role })
    participantTwoRole: Role;
}
