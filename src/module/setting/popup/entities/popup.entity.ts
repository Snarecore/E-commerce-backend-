import { AbstractEntity } from '../../../../database/abstract.entity';
import { Column, Entity, Index } from 'typeorm';

@Entity('popup')
@Index('IDX_popup_schedule', ['isDeleted', 'isActive', 'priority', 'startDate', 'endDate'])
export class Popup extends AbstractEntity {
    @Column({ type: 'varchar', length: 255, nullable: true })
    title?: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'varchar', length: 500 })
    image: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    link?: string;

    @Column({ type: 'int', default: 0 })
    priority: number;

    @Column({ type: 'datetime', nullable: true })
    startDate?: Date;

    @Column({ type: 'datetime', nullable: true })
    endDate?: Date;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;
}
