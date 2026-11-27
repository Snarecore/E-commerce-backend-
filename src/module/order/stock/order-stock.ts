import { EntityManager } from 'typeorm';
import { Product } from '../../inventory/product/entities/product.entity';
import { OrderSummary } from '../../order-summary/entity/order-summary.entity';
import { RecordMovementDto } from '../../inventory-engine/dto/stock-movement.dto';
import { StockMovementType, StockReferenceType } from '../../../enums/stock-movement.enum';

/**
 * Stock bookkeeping for whole orders. The only place that adds or removes an order's quantities
 * from products, so checkout revival, cancellation, expiry and payment rejection all behave
 * identically (lock order, size handling, untracked stock).
 */

type ReservableLine = Pick<OrderSummary, 'productId' | 'quantity'> & Partial<Pick<OrderSummary, 'size' | 'selectedSize'>>;

interface ProductDemand {
    totalQty: number;
    bySize: Map<string, number>;
}

/** Sums the quantity each product (and each of its sizes) needs across order lines. */
function aggregateDemand(lines: ReservableLine[]): Map<string, ProductDemand> {
    const demand = new Map<string, ProductDemand>();
    for (const line of lines) {
        if (!line.productId) continue;
        const qty = Math.max(1, Number(line.quantity) || 1);
        const entry = demand.get(line.productId) ?? { totalQty: 0, bySize: new Map<string, number>() };
        entry.totalQty += qty;
        const size = String(line.size || line.selectedSize || '').trim();
        if (size) entry.bySize.set(size, (entry.bySize.get(size) ?? 0) + qty);
        demand.set(line.productId, entry);
    }
    return demand;
}

/** `quantity = null` means the product's stock is not tracked (unlimited). */
const isTracked = (quantity: number | null | undefined): quantity is number => quantity !== null && quantity !== undefined;

/**
 * Re-deducts stock for an order whose stock was released earlier (expired or cancelled), so
 * it can be revived. All-or-nothing: returns false without changing anything if any line is
 * short. Must run inside the caller's transaction.
 *
 * Rows are locked in ascending product-id order — the same order checkout uses — so two
 * concurrent reservations can never deadlock each other.
 */
export async function reserveOrderStock(manager: EntityManager, lines: ReservableLine[]): Promise<boolean> {
    const demand = aggregateDemand(lines);
    if (demand.size === 0) return false;

    const productIds = [...demand.keys()].sort();
    const locked = new Map<string, Product>();
    for (const productId of productIds) {
        const product = await manager.findOne(Product, { where: { id: productId, isDeleted: false }, lock: { mode: 'pessimistic_write' } });
        if (!product) return false;
        locked.set(productId, product);
    }

    for (const productId of productIds) {
        const product = locked.get(productId)!;
        const need = demand.get(productId)!;
        if (isTracked(product.quantity) && Number(product.quantity) < need.totalQty) return false;
        const sizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : null;
        if (sizeStock) {
            for (const [size, qty] of need.bySize) {
                if ((Number(sizeStock[size]) || 0) < qty) return false;
            }
        }
    }

    for (const productId of productIds) {
        const product = locked.get(productId)!;
        const need = demand.get(productId)!;
        let sizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? { ...product.sizeStock } : product.sizeStock;
        if (sizeStock && typeof sizeStock === 'object') {
            for (const [size, qty] of need.bySize) {
                sizeStock[size] = Math.max(0, (Number(sizeStock[size]) || 0) - qty);
            }
        }
        await manager.update(Product, product.id, {
            // Untracked (null) stock stays untracked instead of collapsing to 0
            quantity: isTracked(product.quantity) ? Math.max(0, Number(product.quantity) - need.totalQty) : product.quantity,
            sizeStock,
        });
    }
    return true;
}

/**
 * Lines of an order. `order-summary.orderId` is a foreign key to `orders.id` (the UUID), not
 * the human order number (BB123456) — looking lines up by the latter silently finds nothing.
 */
export function findOrderLines(manager: EntityManager, order: { id: string }): Promise<OrderSummary[]> {
    return manager.find(OrderSummary, { where: { orderId: order.id } });
}

/** One size (or the product total when `size` is null) whose on-hand quantity changed. */
export interface StockChange {
    product: Product;
    size: string | null;
    quantity: number;
    onHandBefore: number;
    onHandAfter: number;
}

/**
 * Puts an order's quantities back on its products (cancel, reject, expiry). Returns one entry
 * per size (or per product without sizes) so callers can write the stock ledger. Deleted or
 * missing products are skipped. Must run inside the caller's transaction.
 */
export async function releaseOrderStock(manager: EntityManager, lines: ReservableLine[]): Promise<StockChange[]> {
    const demand = aggregateDemand(lines);
    const changes: StockChange[] = [];

    for (const productId of [...demand.keys()].sort()) {
        const product = await manager.findOne(Product, { where: { id: productId }, lock: { mode: 'pessimistic_write' } });
        if (!product) continue;
        const give = demand.get(productId)!;

        const sizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? { ...product.sizeStock } : product.sizeStock;
        if (sizeStock && typeof sizeStock === 'object') {
            for (const [size, qty] of give.bySize) {
                const before = Number(sizeStock[size]) || 0;
                sizeStock[size] = before + qty;
                changes.push({ product, size, quantity: qty, onHandBefore: before, onHandAfter: before + qty });
            }
        }

        const tracked = isTracked(product.quantity);
        const totalBefore = tracked ? Number(product.quantity) : 0;
        if (!sizeStock || typeof sizeStock !== 'object' || give.bySize.size === 0) {
            changes.push({ product, size: null, quantity: give.totalQty, onHandBefore: totalBefore, onHandAfter: totalBefore + give.totalQty });
        }

        await manager.update(Product, product.id, {
            // Untracked (null) stock stays untracked instead of becoming a fixed number
            quantity: tracked ? totalBefore + give.totalQty : product.quantity,
            sizeStock,
        });
    }
    return changes;
}

/** Stock-ledger rows (RecordMovementDto shape) describing a release, for InventoryEngineService.recordMovement. */
export function toReleaseMovements(
    changes: StockChange[],
    ref: { orderId: string; reason: string; note: string }
): RecordMovementDto[] {
    return changes.map((change) => ({
        productId: change.product.id,
        sku: change.product.sku || null,
        size: change.size,
        movementType: StockMovementType.SALE_CANCEL_RELEASE,
        quantityChange: change.quantity,
        onHandBefore: change.onHandBefore,
        onHandAfter: change.onHandAfter,
        referenceType: StockReferenceType.ORDER,
        referenceId: ref.orderId,
        reason: ref.reason,
        note: ref.note,
    }));
}
