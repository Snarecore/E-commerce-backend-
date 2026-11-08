import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';
import { AdjustmentStatus, AdjustmentReason, AdjustmentMode } from '../../../enums/stock-adjustment.enum';
import { StockAdjustmentItem } from './stock-adjustment-item.entity';

@Entity('stock_adjustments')
@Index('IDX_adjustment_number', ['adjustmentNumber'], { unique: true })
@Index('IDX_adjustment_status', ['status'])
@Index('IDX_adjustment_date', ['createdAt'])
export class StockAdjustment extends AbstractEntity {
    @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
    adjustmentNumber: string;

    @Column({
        type: 'enum',
        enum: AdjustmentStatus,
        default: AdjustmentStatus.DRAFT
    })
    status: AdjustmentStatus;

    @Column({
        type: 'enum',
        enum: AdjustmentReason,
        default: AdjustmentReason.OTHER
    })
    reason: AdjustmentReason;

    @Column({
        type: 'enum',
        enum: AdjustmentMode,
        default: AdjustmentMode.SUBTRACTION
    })
    mode: AdjustmentMode;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    attachmentUrl: string | null;

    @Column({ type: 'int', default: 0 })
    totalItemsAdjusted: number;

    @Column({
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: {
            to: (value: number) => value,
            from: (value: string | number | null) => (value !== null && value !== undefined ? Number(value) : 0)
        }
    })
    totalValueImpact: number;

    @Column({ type: 'varchar', length: 36, nullable: true })
    createdByUserId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    createdByName: string | null;

    @Column({ type: 'varchar', length: 36, nullable: true })
    approvedByUserId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    approvedByName: string | null;

    @Column({ type: 'timestamp', nullable: true })
    approvedAt: Date | null;

    @OneToMany(() => StockAdjustmentItem, (item) => item.adjustment, { cascade: true })
    items: StockAdjustmentItem[];
}
