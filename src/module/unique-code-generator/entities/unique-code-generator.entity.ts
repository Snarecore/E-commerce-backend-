import { AbstractEntity } from '../../../database/abstract.entity';
import { Column, Entity, Index } from 'typeorm';

/** Registry of issued codes. The UNIQUE indexes make each insert an atomic reservation. */
@Entity('unique-code-generator')
@Index('UQ_ucg_productCode', ['productCode'], { unique: true })
@Index('UQ_ucg_orderId', ['orderId'], { unique: true })
export class UniqueCodeGenerator extends AbstractEntity {
    @Column({ type: 'varchar', nullable: true })
	productCode: string;

    @Column({ type: 'varchar', nullable: true })
	orderId: string;
}
