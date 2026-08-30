import { AbstractEntity } from '../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('product-image-gallery')
export class ProductImageGallery extends AbstractEntity {
	@Column({ type: 'uuid' })
	productId: string;

    @Column({ type: 'varchar' })
	imageUrl: string;
}
