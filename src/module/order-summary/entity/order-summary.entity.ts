import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { AbstractEntity } from 'src/database/abstract.entity';
import { Orders } from '../../order/entity/order.entity';
import { Product } from 'src/module/inventory/product/entities/product.entity';

@Entity('order-summary')
@Index('IDX_order_summary_vendor_created', ['vendorId', 'createdAt'])
@Index('IDX_order_summary_order', ['orderId'])
export class OrderSummary extends AbstractEntity {
    @Column({ type: 'varchar', nullable: false })
    productId: string;

    @Column({ type: 'varchar', nullable: false })
    productName: string;

    @Column({ type: 'varchar', nullable: true })
    productImage: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
    price: number;

    @Column({ type: 'int', nullable: false })
    quantity: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    commissionAmount: number;

    @Column({ type: 'varchar', nullable: true })
    vendorId: string;

    @Column({ type: 'uuid' })
    orderId: string;

    @ManyToOne(() => Orders, (order) => order.id, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orderId' })
    order: Orders;
}
