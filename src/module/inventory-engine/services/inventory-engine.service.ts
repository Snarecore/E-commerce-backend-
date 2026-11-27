import { randomBytes } from 'crypto';
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockAdjustment } from '../entities/stock-adjustment.entity';
import { StockAdjustmentItem } from '../entities/stock-adjustment-item.entity';
import { Product } from '../../inventory/product/entities/product.entity';
import { adjustmentMovementType, applyStockDelta } from '../utils/stock-delta';
import { findOrderLines } from '../../order/stock/order-stock';
import { Orders } from '../../order/entity/order.entity';
import { OrderSummary } from '../../order-summary/entity/order-summary.entity';
import { RecordMovementDto, AdjustStockParams, QueryStockMovementsDto, QueryLowStockAlertsDto } from '../dto/stock-movement.dto';
import { CreateAdjustmentDto, QueryAdjustmentsDto } from '../dto/stock-adjustment.dto';
import { ProcessReturnDto } from '../dto/stock-return.dto';
import { ExecuteExchangeDto } from '../dto/stock-exchange.dto';
import { InventoryOutboxService } from './inventory-outbox.service';
import { StockMovementType, StockReferenceType } from '../../../enums/stock-movement.enum';
import { AdjustmentStatus, AdjustmentReason, AdjustmentMode } from '../../../enums/stock-adjustment.enum';
import { OrderStatus } from '../../../enums/order-status.enum';
import { resolvePagination } from '../../../utils/pagination.util';

/** Statuses from which a parcel can come back: delivered, or returned by the courier undelivered. */
const RETURNABLE_ORDER_STATUSES = new Set<string>([
    OrderStatus.SHIPPED,
    OrderStatus.LOADED_FOR_DELIVERY,
    OrderStatus.HANDED_OVER_TO_COURIER,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
]);

const returnLineKey = (productId: string, size?: string | null): string => `${productId}${size ? ` / ${size.trim()}` : ''}`;

@Injectable()
export class InventoryEngineService {
    private readonly logger = new Logger(InventoryEngineService.name);

    constructor(
        @InjectRepository(StockMovement)
        private readonly stockMovementRepo: Repository<StockMovement>,
        @InjectRepository(StockAdjustment)
        private readonly stockAdjustmentRepo: Repository<StockAdjustment>,
        @InjectRepository(StockAdjustmentItem)
        private readonly stockAdjustmentItemRepo: Repository<StockAdjustmentItem>,
        @InjectRepository(Product)
        private readonly productRepo: Repository<Product>,
        @InjectRepository(Orders)
        private readonly orderRepo: Repository<Orders>,
        @InjectRepository(OrderSummary)
        private readonly orderSummaryRepo: Repository<OrderSummary>,
        private readonly outboxService: InventoryOutboxService,
        private readonly dataSource: DataSource
    ) {}

    /**
     * Appends an immutable ledger entry.
     * Can execute within an external EntityManager (DB Transaction) or standalone.
     */
    async recordMovement(data: RecordMovementDto, manager?: EntityManager): Promise<StockMovement> {
        const repo = manager ? manager.getRepository(StockMovement) : this.stockMovementRepo;

        if (data.idempotencyKey) {
            const existing = await repo.findOne({ where: { idempotencyKey: data.idempotencyKey } });
            if (existing) {
                this.logger.warn(`[StockLedger Idempotency Hit] Skipping duplicate movement for key: ${data.idempotencyKey}`);
                return existing;
            }
        }

        const movement = repo.create({
            productId: data.productId,
            variantId: data.variantId || null,
            size: data.size || null,
            sku: data.sku || null,
            movementType: data.movementType,
            quantityChange: data.quantityChange,
            onHandBefore: data.onHandBefore,
            onHandAfter: data.onHandAfter,
            reservedBefore: data.reservedBefore || 0,
            reservedAfter: data.reservedAfter || 0,
            availableBefore: data.availableBefore !== undefined ? data.availableBefore : (data.onHandBefore - (data.reservedBefore || 0)),
            availableAfter: data.availableAfter !== undefined ? data.availableAfter : (data.onHandAfter - (data.reservedAfter || 0)),
            referenceType: data.referenceType,
            referenceId: data.referenceId || null,
            idempotencyKey: data.idempotencyKey || null,
            reason: data.reason || null,
            note: data.note || null,
            performedBy: data.performedBy || null,
            performedByName: data.performedByName || null
        });

        return await repo.save(movement);
    }

    /**
     * Authoritative atomic stock adjustment for a single product / variant.
     * Executes within a pessimistic write lock and creates an immutable movement ledger record.
     */
    async adjustStock(params: AdjustStockParams, externalManager?: EntityManager): Promise<{ product: Product; movement: StockMovement }> {
        const executeLogic = async (manager: EntityManager) => {
            const product = await manager.findOne(Product, {
                where: { id: params.productId, isDeleted: false },
                lock: { mode: 'pessimistic_write' }
            });

            if (!product) {
                throw new HttpException(`Product with ID "${params.productId}" not found.`, HttpStatus.NOT_FOUND);
            }

            // Idempotency is checked under the product lock and BEFORE stock changes, so a retried
            // request returns the original result instead of moving stock a second time.
            if (params.idempotencyKey) {
                const previous = await manager.findOne(StockMovement, { where: { idempotencyKey: params.idempotencyKey } });
                if (previous) {
                    this.logger.warn(`[StockLedger Idempotency Hit] Returning existing movement for key: ${params.idempotencyKey}`);
                    return { product, movement: previous };
                }
            }

            const change = applyStockDelta(product, params.size, params.quantityChange);
            const currentOnHand = change.totalBefore;
            const newOnHand = change.totalAfter;

            await manager.update(Product, product.id, { quantity: newOnHand, sizeStock: change.sizeStock });
            product.quantity = newOnHand;
            product.sizeStock = change.sizeStock;

            // Record to immutable ledger
            const movement = await this.recordMovement({
                productId: product.id,
                sku: product.sku || null,
                size: params.size || null,
                movementType: params.movementType,
                quantityChange: params.quantityChange,
                onHandBefore: currentOnHand,
                onHandAfter: newOnHand,
                reservedBefore: 0,
                reservedAfter: 0,
                availableBefore: currentOnHand,
                availableAfter: newOnHand,
                referenceType: params.referenceType,
                referenceId: params.referenceId || null,
                idempotencyKey: params.idempotencyKey || null,
                reason: params.reason || null,
                note: params.note || null,
                performedBy: params.performedBy || null,
                performedByName: params.performedByName || null
            }, manager);

            // Enqueue low/out-of-stock event if threshold breached
            const threshold = product.quantityAlert || 5;
            if (newOnHand <= threshold) {
                await this.outboxService.enqueueEvent(
                    manager,
                    'PRODUCT',
                    product.id,
                    newOnHand === 0 ? 'STOCK_OUT_ALERT' : 'STOCK_LOW_ALERT',
                    {
                        productId: product.id,
                        name: product.name,
                        sku: product.sku,
                        quantity: newOnHand,
                        quantityAlert: threshold
                    }
                );
            }

            return { product, movement };
        };

        if (externalManager) {
            return await executeLogic(externalManager);
        } else {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                const result = await executeLogic(queryRunner.manager);
                await queryRunner.commitTransaction();
                return result;
            } catch (err) {
                await queryRunner.rollbackTransaction();
                throw err;
            } finally {
                await queryRunner.release();
            }
        }
    }

    /**
     * Creates a Stock Adjustment (Draft, Pending Approval, or Completed if instantExecution is true).
     */
    async createAdjustment(dto: CreateAdjustmentDto, user: any): Promise<StockAdjustment> {
        if (!dto.items || dto.items.length === 0) {
            throw new HttpException('Stock adjustment must contain at least one item.', HttpStatus.BAD_REQUEST);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const now = new Date();
            const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
            // 8 hex chars (4 billion values) under a unique index: collisions are practically impossible
            const adjustmentNumber = `ADJ-${yearMonth}-${randomBytes(4).toString('hex').toUpperCase()}`;

            const shouldComplete = dto.instantExecution === true;
            const initialStatus = shouldComplete ? AdjustmentStatus.COMPLETED : AdjustmentStatus.PENDING_APPROVAL;

            const adjustment = queryRunner.manager.create(StockAdjustment, {
                adjustmentNumber,
                status: initialStatus,
                reason: dto.reason || AdjustmentReason.OTHER,
                mode: dto.mode || AdjustmentMode.SUBTRACTION,
                notes: dto.notes || null,
                attachmentUrl: dto.attachmentUrl || null,
                createdByUserId: user?.id || user?.userId || null,
                createdByName: user?.name || user?.email || 'Admin',
                approvedByUserId: shouldComplete ? (user?.id || user?.userId || null) : null,
                approvedByName: shouldComplete ? (user?.name || user?.email || 'Admin') : null,
                approvedAt: shouldComplete ? now : null,
                totalItemsAdjusted: 0,
                totalValueImpact: 0,
                items: []
            });

            await queryRunner.manager.save(adjustment);

            let totalUnitsAdjusted = 0;
            let totalValueImpact = 0;
            const adjustmentItems: StockAdjustmentItem[] = [];

            // Sort product IDs in ASC order for deadlock prevention
            const sortedItemDtos = [...dto.items].sort((a, b) => a.productId.localeCompare(b.productId));

            for (const itemDto of sortedItemDtos) {
                const product = await queryRunner.manager.findOne(Product, {
                    where: { id: itemDto.productId, isDeleted: false },
                    lock: shouldComplete ? { mode: 'pessimistic_write' } : undefined
                });

                if (!product) {
                    throw new HttpException(`Product with ID "${itemDto.productId}" not found.`, HttpStatus.NOT_FOUND);
                }

                const size = itemDto.size?.trim() || null;
                const knownSizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : null;
                // A size the product does not list yet starts at 0, never at the product total
                const prevVariantStock = size ? Number(knownSizeStock?.[size]) || 0 : Number(product.quantity) || 0;

                const quantity = Math.abs(Number(itemDto.quantity) || 0);
                let delta = 0;
                if (itemDto.type === 'IN') delta = quantity;
                else if (itemDto.type === 'OUT') delta = -quantity;
                else if (dto.mode === AdjustmentMode.ADDITION) delta = quantity;
                else if (dto.mode === AdjustmentMode.SUBTRACTION) delta = -quantity;
                else if (dto.mode === AdjustmentMode.EXACT_COUNT) delta = quantity - prevVariantStock; // physical count − system stock

                // Validates the result without writing it (throws 400 if stock would go negative)
                const preview = applyStockDelta(product, size, delta);

                // Valuation always uses the server's cost price; a client-supplied cost is never trusted
                const unitCost = Number(product.cost) || Number(product.price) || 0;
                const subtotalImpact = Number((delta * unitCost).toFixed(2));

                totalUnitsAdjusted += Math.abs(delta);
                totalValueImpact += subtotalImpact;

                const adjustmentItem = queryRunner.manager.create(StockAdjustmentItem, {
                    adjustmentId: adjustment.id,
                    productId: product.id,
                    productName: product.name,
                    sku: product.sku || null,
                    size,
                    previousStock: prevVariantStock,
                    adjustedQuantity: delta,
                    // For EXACT_COUNT this is the counted target; approval re-derives the delta from it
                    newStock: preview.variantAfter,
                    unitCost,
                    subtotalImpact
                });

                await queryRunner.manager.save(adjustmentItem);
                adjustmentItems.push(adjustmentItem);

                if (shouldComplete && delta !== 0) {
                    await queryRunner.manager.update(Product, product.id, { quantity: preview.totalAfter, sizeStock: preview.sizeStock });
                    await this.recordMovement({
                        productId: product.id,
                        sku: product.sku || null,
                        size,
                        movementType: adjustmentMovementType(dto.reason, delta),
                        quantityChange: delta,
                        onHandBefore: preview.totalBefore,
                        onHandAfter: preview.totalAfter,
                        reservedBefore: 0,
                        reservedAfter: 0,
                        availableBefore: preview.totalBefore,
                        availableAfter: preview.totalAfter,
                        referenceType: StockReferenceType.STOCK_ADJUSTMENT,
                        referenceId: adjustment.adjustmentNumber,
                        reason: dto.reason,
                        note: dto.notes || `Stock adjustment ${adjustment.adjustmentNumber}`,
                        performedBy: user?.id || user?.userId || 'ADMIN',
                        performedByName: user?.name || user?.email || 'Admin'
                    }, queryRunner.manager);
                }
            }

            adjustment.totalItemsAdjusted = totalUnitsAdjusted;
            adjustment.totalValueImpact = totalValueImpact;
            adjustment.items = adjustmentItems;
            await queryRunner.manager.save(adjustment);

            await queryRunner.commitTransaction();
            return adjustment;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Approves and executes a Pending Adjustment (Maker-Checker execution).
     */
    async approveAdjustment(adjustmentId: string, user: any): Promise<StockAdjustment> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const adjustment = await queryRunner.manager.findOne(StockAdjustment, {
                where: { id: adjustmentId, isDeleted: false },
                relations: ['items'],
                lock: { mode: 'pessimistic_write' }
            });

            if (!adjustment) {
                throw new HttpException(`Stock Adjustment with ID "${adjustmentId}" not found.`, HttpStatus.NOT_FOUND);
            }

            if (adjustment.status !== AdjustmentStatus.PENDING_APPROVAL && adjustment.status !== AdjustmentStatus.DRAFT) {
                throw new HttpException(`Only pending or draft adjustments can be approved. Current status: ${adjustment.status}`, HttpStatus.BAD_REQUEST);
            }

            // Re-read products in ASC order and apply stock changes
            const sortedItems = [...adjustment.items].sort((a, b) => a.productId.localeCompare(b.productId));

            for (const item of sortedItems) {
                const product = await queryRunner.manager.findOne(Product, {
                    where: { id: item.productId, isDeleted: false },
                    lock: { mode: 'pessimistic_write' }
                });

                if (!product) continue;

                // Stock may have changed since the adjustment was drafted. An exact count states the
                // target quantity, so its delta is re-derived from the stock as it is now.
                const knownSizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : null;
                const currentVariant = item.size ? Number(knownSizeStock?.[item.size]) || 0 : Number(product.quantity) || 0;
                const delta =
                    adjustment.mode === AdjustmentMode.EXACT_COUNT ? Number(item.newStock) - currentVariant : Number(item.adjustedQuantity) || 0;

                const change = applyStockDelta(product, item.size, delta);

                item.previousStock = change.variantBefore;
                item.adjustedQuantity = delta;
                item.newStock = change.variantAfter;
                item.subtotalImpact = Number((delta * (Number(item.unitCost) || 0)).toFixed(2));
                await queryRunner.manager.save(item);

                if (delta === 0) continue;
                await queryRunner.manager.update(Product, product.id, { quantity: change.totalAfter, sizeStock: change.sizeStock });

                await this.recordMovement({
                    productId: product.id,
                    sku: product.sku || null,
                    size: item.size || null,
                    movementType: adjustmentMovementType(adjustment.reason, delta),
                    quantityChange: delta,
                    onHandBefore: change.totalBefore,
                    onHandAfter: change.totalAfter,
                    reservedBefore: 0,
                    reservedAfter: 0,
                    availableBefore: change.totalBefore,
                    availableAfter: change.totalAfter,
                    referenceType: StockReferenceType.STOCK_ADJUSTMENT,
                    referenceId: adjustment.adjustmentNumber,
                    reason: adjustment.reason,
                    note: adjustment.notes || `Stock adjustment ${adjustment.adjustmentNumber}`,
                    performedBy: user?.id || user?.userId || 'ADMIN',
                    performedByName: user?.name || user?.email || 'Admin'
                }, queryRunner.manager);
            }

            adjustment.totalItemsAdjusted = sortedItems.reduce((sum, item) => sum + Math.abs(Number(item.adjustedQuantity) || 0), 0);
            adjustment.totalValueImpact = Number(sortedItems.reduce((sum, item) => sum + (Number(item.subtotalImpact) || 0), 0).toFixed(2));

            adjustment.status = AdjustmentStatus.COMPLETED;
            adjustment.approvedByUserId = user?.id || user?.userId || null;
            adjustment.approvedByName = user?.name || user?.email || 'Admin';
            adjustment.approvedAt = new Date();

            await queryRunner.manager.save(adjustment);
            await queryRunner.commitTransaction();

            return adjustment;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Rejects an adjustment.
     */
    async rejectAdjustment(adjustmentId: string, user: any, reason?: string): Promise<StockAdjustment> {
        const adjustment = await this.stockAdjustmentRepo.findOne({
            where: { id: adjustmentId, isDeleted: false }
        });

        if (!adjustment) {
            throw new HttpException(`Stock Adjustment with ID "${adjustmentId}" not found.`, HttpStatus.NOT_FOUND);
        }

        if (adjustment.status === AdjustmentStatus.COMPLETED) {
            throw new HttpException('Completed adjustments cannot be rejected. Use a reversal adjustment instead.', HttpStatus.BAD_REQUEST);
        }

        adjustment.status = AdjustmentStatus.REJECTED;
        adjustment.notes = reason ? `${adjustment.notes || ''} [Rejected: ${reason}]`.trim() : adjustment.notes;
        adjustment.approvedByUserId = user?.id || user?.userId || null;
        adjustment.approvedByName = user?.name || user?.email || 'Admin';
        adjustment.approvedAt = new Date();

        return await this.stockAdjustmentRepo.save(adjustment);
    }

    /**
     * Query adjustments list with pagination and filters
     */
    async getAdjustments(query: QueryAdjustmentsDto): Promise<{ data: StockAdjustment[]; total: number; page: number; limit: number }> {
        const { page, limit, skip } = resolvePagination(query.page, query.limit, 20);

        const qb = this.stockAdjustmentRepo.createQueryBuilder('adj')
            .leftJoinAndSelect('adj.items', 'items')
            .where('adj.isDeleted = :isDeleted', { isDeleted: false });

        if (query.status) {
            qb.andWhere('adj.status = :status', { status: query.status });
        }
        if (query.reason) {
            qb.andWhere('adj.reason = :reason', { reason: query.reason });
        }
        if (query.startDate) {
            qb.andWhere('adj.createdAt >= :startDate', { startDate: query.startDate });
        }
        if (query.endDate) {
            qb.andWhere('adj.createdAt <= :endDate', { endDate: query.endDate });
        }

        qb.orderBy('adj.createdAt', 'DESC')
          .skip(skip)
          .take(limit);

        const [data, total] = await qb.getManyAndCount();

        return { data, total, page, limit };
    }

    /**
     * Get a single adjustment by ID with items
     */
    async getAdjustmentById(id: string): Promise<StockAdjustment> {
        const adjustment = await this.stockAdjustmentRepo.findOne({
            where: { id, isDeleted: false },
            relations: ['items']
        });

        if (!adjustment) {
            throw new HttpException(`Stock Adjustment with ID "${id}" not found.`, HttpStatus.NOT_FOUND);
        }

        return adjustment;
    }

    /**
     * Read current stock availability
     */
    async getAvailability(productId: string, size?: string): Promise<{ onHand: number; reserved: number; available: number; sizeStock: Record<string, number> | null }> {
        const product = await this.productRepo.findOne({
            where: { id: productId, isDeleted: false }
        });

        if (!product) {
            throw new HttpException(`Product with ID "${productId}" not found.`, HttpStatus.NOT_FOUND);
        }

        const onHand = Number(product.quantity) || 0;
        const sizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : null;

        if (size && sizeStock) {
            const variantOnHand = Number(sizeStock[size]) || 0;
            return {
                onHand: variantOnHand,
                reserved: 0,
                available: variantOnHand,
                sizeStock
            };
        }

        return {
            onHand,
            reserved: 0,
            available: onHand,
            sizeStock
        };
    }

    /**
     * Query the immutable stock ledger
     */
    async getMovements(query: QueryStockMovementsDto): Promise<{ data: StockMovement[]; total: number; page: number; limit: number }> {
        const { page, limit, skip } = resolvePagination(query.page, query.limit, 20);

        const qb = this.stockMovementRepo.createQueryBuilder('movement')
            .where('movement.isDeleted = :isDeleted', { isDeleted: false });

        if (query.productId) {
            qb.andWhere('movement.productId = :productId', { productId: query.productId });
        }
        if (query.movementType) {
            qb.andWhere('movement.movementType = :movementType', { movementType: query.movementType });
        }
        if (query.referenceType) {
            qb.andWhere('movement.referenceType = :referenceType', { referenceType: query.referenceType });
        }
        if (query.referenceId) {
            qb.andWhere('movement.referenceId = :referenceId', { referenceId: query.referenceId });
        }

        qb.orderBy('movement.createdAt', 'DESC')
          .skip(skip)
          .take(limit);

        const [data, total] = await qb.getManyAndCount();

        return { data, total, page, limit };
    }

    /**
     * Process an Order Return (RMA) with physical inspection.
     * Items marked 'GOOD' are restocked (+quantity) and logged to the ledger as RETURN_RESTOCK.
     * Items marked 'DAMAGED' are NOT added to sellable stock; an automated StockAdjustment
     * is created and logged to the ledger as ADJUSTMENT_DAMAGE.
     */
    async processOrderReturn(dto: ProcessReturnDto, user: any): Promise<{ order: Orders; restoredItems: any[]; damagedItems: any[] }> {
        if (!dto.items || dto.items.length === 0) {
            throw new HttpException('Return request must contain at least one item.', HttpStatus.BAD_REQUEST);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const cleanOrderId = dto.orderId.replace(/^#/, '').trim();
            const order = await queryRunner.manager.findOne(Orders, {
                where: [{ id: cleanOrderId }, { orderId: cleanOrderId }],
                lock: { mode: 'pessimistic_write' }
            });

            if (!order) {
                throw new HttpException(`Order "${dto.orderId}" not found.`, HttpStatus.NOT_FOUND);
            }

            // A return can only be processed once, for a parcel that actually left the warehouse.
            // Cancelled/rejected orders were already restocked automatically.
            if (!RETURNABLE_ORDER_STATUSES.has(order.status)) {
                throw new HttpException(
                    order.status === OrderStatus.RETURNED
                        ? `Order ${order.orderId} has already been processed as returned.`
                        : `Order ${order.orderId} cannot be returned from status "${order.status}".`,
                    HttpStatus.CONFLICT
                );
            }

            // Every returned line must exist on the order, and never exceed what was ordered
            const lines = await findOrderLines(queryRunner.manager, order);
            const ordered = new Map<string, number>();
            for (const line of lines) {
                const key = returnLineKey(line.productId, line.size || line.selectedSize);
                ordered.set(key, (ordered.get(key) ?? 0) + (Number(line.quantity) || 0));
            }
            const requested = new Map<string, number>();
            for (const item of dto.items) {
                const key = returnLineKey(item.productId, item.size);
                requested.set(key, (requested.get(key) ?? 0) + Math.max(1, Number(item.returnedQuantity) || 1));
            }
            for (const [key, qty] of requested) {
                const orderedQty = ordered.get(key) ?? 0;
                if (qty > orderedQty) {
                    throw new HttpException(
                        `Cannot return ${qty} of "${key}": order ${order.orderId} contains ${orderedQty}.`,
                        HttpStatus.BAD_REQUEST
                    );
                }
            }

            const restoredItems: any[] = [];
            const damagedItems: any[] = [];

            // Sort products in ASC order to avoid deadlocks
            const sortedItems = [...dto.items].sort((a, b) => a.productId.localeCompare(b.productId));

            for (const item of sortedItems) {
                const product = await queryRunner.manager.findOne(Product, {
                    where: { id: item.productId, isDeleted: false },
                    lock: { mode: 'pessimistic_write' }
                });

                if (!product) continue;

                const qty = Math.max(1, Number(item.returnedQuantity) || 1);
                const currentOnHand = Number(product.quantity) || 0;
                let currentSizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? { ...product.sizeStock } : null;

                if (item.condition === 'GOOD') {
                    // Restock item
                    const newTotalOnHand = currentOnHand + qty;
                    if (item.size) {
                        if (!currentSizeStock) currentSizeStock = {};
                        currentSizeStock[item.size] = (Number(currentSizeStock[item.size]) || 0) + qty;
                    }

                    await queryRunner.manager.update(Product, product.id, {
                        quantity: newTotalOnHand,
                        sizeStock: currentSizeStock
                    });

                    await this.recordMovement({
                        productId: product.id,
                        sku: product.sku || null,
                        size: item.size || null,
                        movementType: StockMovementType.RETURN_RESTOCK,
                        quantityChange: qty,
                        onHandBefore: currentOnHand,
                        onHandAfter: newTotalOnHand,
                        referenceType: StockReferenceType.RETURN,
                        referenceId: order.orderId,
                        reason: dto.reason || 'Customer Return (Restocked)',
                        note: item.notes || `Returned item in good condition from Order ${order.orderId}`,
                        performedBy: user?.id || user?.userId || 'ADMIN',
                        performedByName: user?.name || user?.email || 'Admin'
                    }, queryRunner.manager);

                    restoredItems.push({ productId: product.id, name: product.name, size: item.size, qty });
                } else {
                    // DAMAGED: Do NOT add to sellable stock. Record as write-off adjustment
                    const unitCost = Number(product.cost) || Number(product.price) || 0;
                    const subtotalImpact = Number((-qty * unitCost).toFixed(2));

                    const now = new Date();
                    const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
                    const adjNumber = `ADJ-RMA-${yearMonth}-${randomBytes(4).toString('hex').toUpperCase()}`;

                    const adjustment = queryRunner.manager.create(StockAdjustment, {
                        adjustmentNumber: adjNumber,
                        status: AdjustmentStatus.COMPLETED,
                        reason: AdjustmentReason.DAMAGED,
                        mode: AdjustmentMode.SUBTRACTION,
                        notes: `Damaged return from Order ${order.orderId}: ${item.notes || dto.reason || 'Defective/Damaged item'}`,
                        totalItemsAdjusted: qty,
                        totalValueImpact: subtotalImpact,
                        createdByUserId: user?.id || user?.userId || null,
                        createdByName: user?.name || user?.email || 'Admin',
                        approvedByUserId: user?.id || user?.userId || null,
                        approvedByName: user?.name || user?.email || 'Admin',
                        approvedAt: now
                    });
                    await queryRunner.manager.save(adjustment);

                    const adjustmentItem = queryRunner.manager.create(StockAdjustmentItem, {
                        adjustmentId: adjustment.id,
                        productId: product.id,
                        productName: product.name,
                        sku: product.sku || null,
                        size: item.size || null,
                        previousStock: currentOnHand,
                        adjustedQuantity: -qty,
                        newStock: currentOnHand,
                        unitCost,
                        subtotalImpact
                    });
                    await queryRunner.manager.save(adjustmentItem);

                    await this.recordMovement({
                        productId: product.id,
                        sku: product.sku || null,
                        size: item.size || null,
                        movementType: StockMovementType.ADJUSTMENT_DAMAGE,
                        quantityChange: 0,
                        onHandBefore: currentOnHand,
                        onHandAfter: currentOnHand,
                        referenceType: StockReferenceType.RETURN,
                        referenceId: `${order.orderId} / ${adjNumber}`,
                        reason: 'DAMAGED_RETURN',
                        note: `Damaged item quarantined from Order ${order.orderId}: ${item.notes || 'Defective'}`,
                        performedBy: user?.id || user?.userId || 'ADMIN',
                        performedByName: user?.name || user?.email || 'Admin'
                    }, queryRunner.manager);

                    damagedItems.push({ productId: product.id, name: product.name, size: item.size, qty, adjustmentNumber: adjNumber });
                }
            }

            // Update order status & timeline
            order.status = OrderStatus.RETURNED;
            const nowIso = new Date().toISOString();
            const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
            history.push({
                status: OrderStatus.RETURNED,
                timestamp: nowIso,
                updatedBy: user?.name || user?.email || 'Admin',
                updatedByUserId: user?.id || user?.userId,
                note: `Return processed (Restored: ${restoredItems.length} items, Damaged: ${damagedItems.length} items). Reason: ${dto.reason}`
            });
            order.statusHistory = history;

            await queryRunner.manager.save(order);
            await queryRunner.commitTransaction();

            return { order, restoredItems, damagedItems };
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Executes an atomic size/variant exchange for an item within an order.
     * Decrements target size stock, increments returned size stock, logs 2 immutable ledger entries,
     * updates orderSummary and records the audit history on the order.
     */
    async executeOrderExchange(dto: ExecuteExchangeDto, user?: any): Promise<{
        success: boolean;
        order: Orders;
        product: Product;
        exchangedItem: {
            oldSize: string;
            newSize: string;
            quantity: number;
        };
    }> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const cleanOrderId = dto.orderId.replace(/^#/, '').trim();
            const order = await queryRunner.manager.findOne(Orders, {
                where: [{ id: cleanOrderId }, { orderId: cleanOrderId }],
                relations: ['orderSummaries'],
                lock: { mode: 'pessimistic_write' }
            });

            if (!order) {
                throw new HttpException(`Order "${dto.orderId}" not found.`, HttpStatus.NOT_FOUND);
            }

            if ([OrderStatus.CANCELLED, OrderStatus.REJECTED, OrderStatus.FAILED].includes(order.status as any)) {
                throw new HttpException(`Cannot perform exchange on an order with status "${order.status}".`, HttpStatus.BAD_REQUEST);
            }

            if (!order.orderSummaries || order.orderSummaries.length === 0) {
                throw new HttpException(`Order #${order.orderId} has no item summaries.`, HttpStatus.BAD_REQUEST);
            }

            // Find the item to exchange
            const targetItem = order.orderSummaries.find(item => {
                if (dto.orderSummaryId && item.id === dto.orderSummaryId) return true;
                const matchProduct = item.productId === dto.productId;
                const matchSize = (item.size && item.size.trim().toLowerCase() === dto.oldSize.trim().toLowerCase()) ||
                                  (item.selectedSize && item.selectedSize.trim().toLowerCase() === dto.oldSize.trim().toLowerCase());
                return matchProduct && matchSize;
            });

            if (!targetItem) {
                throw new HttpException(`Matching order item not found for product "${dto.productId}" and size "${dto.oldSize}".`, HttpStatus.NOT_FOUND);
            }

            // 🛡️ Strict 1-Time Exchange Rule Per Order & Per Item (Order proti 1 bar er beshi change kora jabe na)
            const hasOrderAlreadyExchanged = Boolean(
                order.isExchanged ||
                (order.exchangeCount && order.exchangeCount >= 1) ||
                order.orderSummaries?.some(item => item.isExchanged || (item.exchangeCount && item.exchangeCount >= 1))
            );

            if (hasOrderAlreadyExchanged) {
                throw new HttpException(
                    `This order (#${order.orderId}) has already used its 1 allowed exchange policy. As per store policy, an order can only be exchanged once regardless of the number of items.`,
                    HttpStatus.BAD_REQUEST
                );
            }

            if (targetItem.isExchanged || (targetItem.exchangeCount && targetItem.exchangeCount >= 1)) {
                throw new HttpException(
                    `This item has already been exchanged once (Original Size: ${targetItem.originalSize || targetItem.size || 'N/A'}). ` +
                    `As per store policy, items can only be exchanged once to prevent shipping loss and policy abuse.`,
                    HttpStatus.BAD_REQUEST
                );
            }

            const exchangeQty = Math.max(1, Number(dto.quantity) || 1);
            if (exchangeQty > targetItem.quantity) {
                throw new HttpException(`Exchange quantity (${exchangeQty}) exceeds ordered item quantity (${targetItem.quantity}).`, HttpStatus.BAD_REQUEST);
            }

            if (dto.oldSize.trim().toLowerCase() === dto.newSize.trim().toLowerCase()) {
                throw new HttpException(`Target size "${dto.newSize}" must be different from current size "${dto.oldSize}".`, HttpStatus.BAD_REQUEST);
            }

            // Load product with pessimistic write lock
            const product = await queryRunner.manager.findOne(Product, {
                where: { id: dto.productId, isDeleted: false },
                lock: { mode: 'pessimistic_write' }
            });

            if (!product) {
                throw new HttpException(`Product with ID "${dto.productId}" not found.`, HttpStatus.NOT_FOUND);
            }

            let sizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? { ...product.sizeStock } : {};

            // Find the new size key case-insensitively
            const newSizeKey = Object.keys(sizeStock).find(k => k.trim().toLowerCase() === dto.newSize.trim().toLowerCase()) || dto.newSize;
            const oldSizeKey = Object.keys(sizeStock).find(k => k.trim().toLowerCase() === dto.oldSize.trim().toLowerCase()) || dto.oldSize;

            const availableStock = Number(sizeStock[newSizeKey]) || 0;
            if (availableStock < exchangeQty) {
                throw new HttpException(`Insufficient stock for size "${dto.newSize}". Available: ${availableStock}, Requested: ${exchangeQty}.`, HttpStatus.BAD_REQUEST);
            }

            // Update product sizeStock (Old size returned, New size dispatched)
            sizeStock[oldSizeKey] = (Number(sizeStock[oldSizeKey]) || 0) + exchangeQty;
            sizeStock[newSizeKey] = availableStock - exchangeQty;

            await queryRunner.manager.update(Product, product.id, {
                sizeStock
            });

            // 1. Record Old Size Return movement
            await this.recordMovement({
                productId: product.id,
                sku: product.sku || null,
                size: dto.oldSize,
                movementType: StockMovementType.EXCHANGE_SWAP,
                quantityChange: exchangeQty,
                onHandBefore: Number(product.quantity) || 0,
                onHandAfter: Number(product.quantity) || 0,
                referenceType: StockReferenceType.EXCHANGE,
                referenceId: order.orderId,
                reason: dto.reason || 'Customer Exchange (Returned)',
                note: dto.note || `Size Exchange: returned ${dto.oldSize} in exchange for ${dto.newSize} (Order #${order.orderId})`,
                performedBy: user?.id || user?.userId || 'ADMIN',
                performedByName: user?.name || user?.email || 'Admin'
            }, queryRunner.manager);

            // 2. Record New Size Dispatch movement
            await this.recordMovement({
                productId: product.id,
                sku: product.sku || null,
                size: dto.newSize,
                movementType: StockMovementType.EXCHANGE_SWAP,
                quantityChange: -exchangeQty,
                onHandBefore: Number(product.quantity) || 0,
                onHandAfter: Number(product.quantity) || 0,
                referenceType: StockReferenceType.EXCHANGE,
                referenceId: order.orderId,
                reason: dto.reason || 'Customer Exchange (Dispatched)',
                note: dto.note || `Size Exchange: dispatched ${dto.newSize} in exchange for ${dto.oldSize} (Order #${order.orderId})`,
                performedBy: user?.id || user?.userId || 'ADMIN',
                performedByName: user?.name || user?.email || 'Admin'
            }, queryRunner.manager);

            // 3. Update OrderSummary line items
            if (exchangeQty === targetItem.quantity) {
                targetItem.originalSize = targetItem.originalSize || targetItem.size || dto.oldSize;
                targetItem.size = dto.newSize;
                targetItem.selectedSize = dto.newSize;
                targetItem.isExchanged = true;
                targetItem.exchangeCount = (targetItem.exchangeCount || 0) + 1;
                await queryRunner.manager.save(OrderSummary, targetItem);
            } else {
                targetItem.quantity -= exchangeQty;
                targetItem.totalCost = Number(targetItem.unitCostPrice || 0) * targetItem.quantity;
                await queryRunner.manager.save(OrderSummary, targetItem);

                const newItem = queryRunner.manager.create(OrderSummary, {
                    orderId: order.id,
                    order: order,
                    productId: targetItem.productId,
                    productName: targetItem.productName,
                    productImage: targetItem.productImage,
                    size: dto.newSize,
                    selectedSize: dto.newSize,
                    originalSize: targetItem.size || dto.oldSize,
                    isExchanged: true,
                    exchangeCount: 1,
                    price: targetItem.price,
                    quantity: exchangeQty,
                    unitCostPrice: targetItem.unitCostPrice,
                    totalCost: Number(targetItem.unitCostPrice || 0) * exchangeQty,
                    costSource: targetItem.costSource,
                    snapshotMainCategoryId: targetItem.snapshotMainCategoryId,
                    snapshotFirstCategoryId: targetItem.snapshotFirstCategoryId,
                    snapshotSecondCategoryId: targetItem.snapshotSecondCategoryId,
                    commissionAmount: targetItem.commissionAmount,
                    vendorId: targetItem.vendorId
                });
                await queryRunner.manager.save(OrderSummary, newItem);
            }

            // 4. Record audit entry on Order
            const nowIso = new Date().toISOString();
            const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
            history.push({
                status: order.status,
                timestamp: nowIso,
                updatedBy: user?.name || user?.email || 'Admin',
                updatedByUserId: user?.id || user?.userId,
                note: `Size Exchange executed: "${product.name}" [${dto.oldSize} -> ${dto.newSize}] (Qty: ${exchangeQty}). Reason: ${dto.reason || 'Customer request'}${dto.note ? ` | Note: ${dto.note}` : ''}`
            });
            order.statusHistory = history;
            order.isExchanged = true;
            order.exchangeCount = (order.exchangeCount || 0) + 1;
            order.exchangedAt = new Date();

            await queryRunner.manager.save(order);
            await queryRunner.commitTransaction();

            product.sizeStock = sizeStock;
            return {
                success: true,
                order,
                product,
                exchangedItem: {
                    oldSize: dto.oldSize,
                    newSize: dto.newSize,
                    quantity: exchangeQty
                }
            };
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Aggregates real-time inventory health, total valuation (cost vs retail),
     * low-stock counts, and ledger activity.
     */
    async getInventoryAnalyticsSummary(): Promise<{
        totalProducts: number;
        totalStockOnHand: number;
        totalCostValue: number;
        totalRetailValue: number;
        potentialGrossProfit: number;
        lowStockCount: number;
        outOfStockCount: number;
        totalMovementsLast30Days: number;
    }> {
        const summaryRaw = await this.productRepo
            .createQueryBuilder('p')
            .select('COUNT(p.id)', 'totalProducts')
            .addSelect('COALESCE(SUM(p.quantity), 0)', 'totalStockOnHand')
            .addSelect('COALESCE(SUM(p.quantity * COALESCE(p.cost, p.price, 0)), 0)', 'totalCostValue')
            .addSelect('COALESCE(SUM(p.quantity * p.price), 0)', 'totalRetailValue')
            .addSelect('COALESCE(SUM(CASE WHEN p.quantity = 0 THEN 1 ELSE 0 END), 0)', 'outOfStockCount')
            .addSelect('COALESCE(SUM(CASE WHEN p.quantity > 0 AND p.quantity <= COALESCE(p.quantityAlert, 5) THEN 1 ELSE 0 END), 0)', 'lowStockCount')
            .where('p.isDeleted = false')
            .getRawOne();

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const movementsCount = await this.stockMovementRepo
            .createQueryBuilder('m')
            .where('m.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
            .getCount();

        const totalCostValue = Number(Number(summaryRaw?.totalCostValue || 0).toFixed(2));
        const totalRetailValue = Number(Number(summaryRaw?.totalRetailValue || 0).toFixed(2));
        const potentialGrossProfit = Number((totalRetailValue - totalCostValue).toFixed(2));

        return {
            totalProducts: Number(summaryRaw?.totalProducts || 0),
            totalStockOnHand: Number(summaryRaw?.totalStockOnHand || 0),
            totalCostValue,
            totalRetailValue,
            potentialGrossProfit,
            lowStockCount: Number(summaryRaw?.lowStockCount || 0),
            outOfStockCount: Number(summaryRaw?.outOfStockCount || 0),
            totalMovementsLast30Days: Number(movementsCount || 0)
        };
    }

    /**
     * Fetches products that have breached low-stock thresholds or are completely out of stock.
     */
    async getLowStockAlerts(query: QueryLowStockAlertsDto): Promise<{
        data: Product[];
        total: number;
        page: number;
        limit: number;
        pageCount: number;
    }> {
        const { page, limit, skip } = resolvePagination(query.page, query.limit, 20);

        const qb = this.productRepo
            .createQueryBuilder('p')
            .where('p.isDeleted = false');

        if (query.outOfStockOnly) {
            qb.andWhere('p.quantity = 0');
        } else {
            qb.andWhere('(p.quantity = 0 OR p.quantity <= COALESCE(p.quantityAlert, 5))');
        }

        if (query.search && query.search.trim()) {
            qb.andWhere('(p.name LIKE :s OR p.sku LIKE :s)', { s: `%${query.search.trim()}%` });
        }

        qb.orderBy('p.quantity', 'ASC')
          .addOrderBy('p.updatedAt', 'DESC')
          .skip(skip)
          .take(limit);

        const [data, total] = await qb.getManyAndCount();

        return {
            data,
            total,
            page,
            limit,
            pageCount: Math.ceil(total / limit) || 1
        };
    }
}
