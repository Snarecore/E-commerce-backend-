import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('unique-code-generator')
export class UniqueCodeGenerator extends AbstractEntity {
    @Column({ type: 'varchar', nullable: true })
	productCode: string;

    @Column({ type: 'varchar', nullable: true })
	orderId: string;
}
