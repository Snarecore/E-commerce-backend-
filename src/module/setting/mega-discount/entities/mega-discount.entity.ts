import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('mega_discount')
export class MegaDiscount extends AbstractEntity {
	@Column({ type: 'boolean', default: false })
	isActive: boolean;

	@Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
	discountPercentage: number;

	@Column({ type: 'varchar', length: 50, nullable: true, default: 'Mega Sale' })
	menuText: string;
}
