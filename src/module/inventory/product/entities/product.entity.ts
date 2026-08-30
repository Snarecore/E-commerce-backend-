import { AbstractEntity } from '../../../../database/abstract.entity';
import { ProductSeo } from '../../../seo/product-meta/entity/product-seo.entity';
import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { ProductComment } from '../../product-comment/entities/product-comment.entity';
import { DiscountType } from '../../../../enums/product.enum';

@Entity('product')
@Index('IDX_product_slug', ['slug'])
@Index('IDX_product_vendor_status', ['vendorId', 'status', 'isApprove', 'isDeleted'])
@Index('IDX_product_main_category', ['mainCategoryId', 'status', 'isApprove', 'isDeleted'])
@Index('IDX_product_first_category', ['firstCategoryId', 'status', 'isApprove', 'isDeleted'])
@Index('IDX_product_second_category', ['secondCategoryId', 'status', 'isApprove', 'isDeleted'])
@Index('IDX_product_status_approve_created', ['status', 'isApprove', 'isDeleted', 'createdAt'])
export class Product extends AbstractEntity {
	@Column({ type: 'varchar', nullable: false })
	name: string;

	@Column({ type: 'varchar', nullable: false })
	slug: string;

	@Column({ type: 'varchar', nullable: false })
	sku: string;

	@Column({ type: 'varchar', nullable: true })
	featuredImage: string;

	@Column({ type: 'longtext', nullable: true })
	description: string;

	@Column({ type: 'varchar', nullable: true })
	videoUrl: string;

	@Column({ type: 'varchar', nullable: true })
	fileUrl: string;

	@Column({ type: 'longtext', nullable: true })
	summary: string;

	@Column({ type: 'float', nullable: false })
	price: number;

	@Column({ type: 'float', nullable: true })
	cost: number;

	@Column({ type: 'enum', enum: DiscountType, default: DiscountType.NONE })
  	discountType: DiscountType;

	@Column({ type: 'float', nullable: true })
	discountAmount: number;

	@Column({ type: 'uuid', nullable: false })
	mainCategoryId: string;

	@Column({ type: 'varchar', nullable: false })
	mainCategoryName: string;

	@Column({ type: 'uuid', nullable: true })
	firstCategoryId: string;

	@Column({ type: 'varchar', nullable: true })
	firstCategoryName: string;

	@Column({ type: 'uuid', nullable: true })
	secondCategoryId: string;

	@Column({ type: 'varchar', nullable: true })
	secondCategoryName: string;

	@Column({ type: 'varchar', nullable: false })
	vendorId: string;

	@Column({ type: 'varchar', nullable: false })
	vendorName: string;

	@Column({ type: 'float', nullable: true, default: 0 })
	rating: number;

	@Column({ type: 'boolean', default: false })
	status: boolean;

	@Column({ type: 'boolean', default: false })
	isApprove: boolean;

	@Column({ type: 'boolean', default: false })
	isProductSectionOne: boolean;

	@Column({ type: 'boolean', default: false })
	isProductSectionTwo: boolean;

	@Column({ type: 'boolean', default: false })
	isProductSectionThree: boolean;

	@Column({ type: 'boolean', default: false })
	isProductSectionFour: boolean;

	@Column({ type: 'boolean', default: false })
	isProductSectionFive: boolean;

	@Column({ type: 'boolean', default: false })
	isProductSectionSix: boolean;

	@Column({ type: 'varchar', nullable: true })
	sizesString: string;

	@Column({ type: 'json', nullable: true })
	sizeStock: Record<string, number> | null;

	@Column({ type: 'int', default: 0 })
	quantity: number;

	@Column({ type: 'int', default: 0 })
	quantityAlert: number;

	@OneToOne(() => ProductSeo, (seo) => seo.product, { cascade: true, eager: true })
	seo: ProductSeo;

	@OneToMany(() => ProductComment, (c) => c.product)
	comments?: ProductComment[];
}
