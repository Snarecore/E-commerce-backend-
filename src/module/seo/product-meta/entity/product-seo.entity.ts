import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { AbstractEntity } from 'src/database/abstract.entity';
import { Product } from 'src/module/inventory/product/entities/product.entity';

@Entity('product-seo')
export class ProductSeo extends AbstractEntity {
    @Column({ type: 'varchar', nullable: true })
    metaTitle: string;

    @Column({ type: 'text', nullable: true })
    metaDescription: string;

    @Column({ type: 'text', nullable: true })
    metaKeywords: string;

    @OneToOne(() => Product, product => product.seo, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'productId' })
    product: Product;

    @Column({ type: 'varchar' })
    productId: string;

    @Column({ type: 'varchar' })
    productName: string;

    @Column({ type: 'varchar' })
    productImage: string;
}
