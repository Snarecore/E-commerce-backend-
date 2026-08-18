import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('product-review')
export class ProductReview extends AbstractEntity {
	@Column({ type: 'uuid' })
	productId: string;

    @Column({ type: 'float' })
	rating: number;

    @Column({ type: 'uuid' })
	userId: string;

	@Column({ type: 'uuid' })
	vendorId: string;
}
