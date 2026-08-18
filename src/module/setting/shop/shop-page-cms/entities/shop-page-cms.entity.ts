import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('shop-page-cms')
export class ShopPageCms extends AbstractEntity {
	@Column({ type: 'varchar' })
	bannerImage: string;
}
