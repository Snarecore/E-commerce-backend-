import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';
import { StockAdjustment } from './stock-adjustment.entity';

@Entity('stock_adjustment_items')
@Index('IDX_adj_item_adjustment', ['adjustmentId'])
@Index('IDX_adj_item_product', ['productId'])
export class StockAdjustmentItem extends AbstractEntity {
    @Column({ type: 'varchar', length: 36, nullable: false })
    adjustmentId: string;

    @Column({ type: 'varchar', length: 36, nullable: false })
    productId: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    productName: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    sku: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    size: string | null;

    @Column({ type: 'int', default: 0 })
    previousStock: number;

    @Column({ type: 'int', nullable: false })
    adjustedQuantity: number;

    @Column({ type: 'int', default: 0 })
    newStock: number;

    @Column({
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
        transformer: {
            to: (value: number) => value,
            from: (value: string | number | null) => (value !== null && value !== undefined ? Number(value) : 0)
        }
    })
    unitCost: number;

    @Column({
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
        transformer: {
            to: (value: number) => value,
            from: (value: string | number | null) => (value !== null && value !== undefined ? Number(value) : 0)
        }
    })
    subtotalImpact: number;

    @ManyToOne(() => StockAdjustment, (adj) => adj.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'adjustmentId' })
    adjustment: StockAdjustment;
}
