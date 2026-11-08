import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';
import { StockMovementType, StockReferenceType } from '../../../enums/stock-movement.enum';

@Entity('stock_movements')
@Index('IDX_stock_movement_product_created', ['productId', 'createdAt'])
@Index('IDX_stock_movement_ref', ['referenceType', 'referenceId'])
@Index('IDX_stock_movement_type', ['movementType', 'createdAt'])
@Index('IDX_stock_movement_idempotency', ['idempotencyKey'])
export class StockMovement extends AbstractEntity {
    @Column({ type: 'varchar', length: 36, nullable: false })
    productId: string;

    @Column({ type: 'varchar', length: 36, nullable: true })
    variantId: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    size: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    sku: string | null;

    @Column({
        type: 'enum',
        enum: StockMovementType,
        nullable: false
    })
    movementType: StockMovementType;

    @Column({ type: 'int', nullable: false })
    quantityChange: number;

    @Column({ type: 'int', default: 0 })
    onHandBefore: number;

    @Column({ type: 'int', default: 0 })
    onHandAfter: number;

    @Column({ type: 'int', default: 0 })
    reservedBefore: number;

    @Column({ type: 'int', default: 0 })
    reservedAfter: number;

    @Column({ type: 'int', default: 0 })
    availableBefore: number;

    @Column({ type: 'int', default: 0 })
    availableAfter: number;

    @Column({
        type: 'enum',
        enum: StockReferenceType,
        nullable: false
    })
    referenceType: StockReferenceType;

    @Column({ type: 'varchar', length: 255, nullable: true })
    referenceId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    idempotencyKey: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    reason: string | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    performedBy: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    performedByName: string | null;
}
