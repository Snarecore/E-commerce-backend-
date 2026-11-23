import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { IncompleteCheckout, CartItemSnapshot } from './entities/incomplete-checkout.entity';
import { CheckoutRecoveryActivity } from './entities/checkout-recovery-activity.entity';
import { CheckoutStatus } from './enums/checkout-status.enum';
import { RecoveryAction } from './enums/recovery-action.enum';
import { TrackCheckoutDto } from './dto/track-checkout.dto';
import { IncompleteCheckoutFilterDto } from './dto/incomplete-checkout-filter.dto';
import { UpdateCheckoutStatusDto } from './dto/update-checkout-status.dto';
import { CreateRecoveryActivityDto } from './dto/create-recovery-activity.dto';
import { Product } from '../inventory/product/entities/product.entity';
import { normalizeBDPhone, isValidBDPhone } from '../../utils/phone-normalizer.util';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';
import { OrdersService } from '../order/order.service';
import { CreateOrdersDto } from '../order/dto/create-order.dto';

@Injectable()
export class IncompleteCheckoutService {
    private readonly logger = new Logger(IncompleteCheckoutService.name);

    constructor(
        @InjectRepository(IncompleteCheckout)
        private readonly checkoutRepo: Repository<IncompleteCheckout>,
        @InjectRepository(CheckoutRecoveryActivity)
        private readonly activityRepo: Repository<CheckoutRecoveryActivity>,
        @InjectRepository(Product)
        private readonly productRepo: Repository<Product>,
        private readonly dataSource: DataSource,
        private readonly ordersService: OrdersService
    ) {}

    /**
     * Compute SHA-256 hash of opaque client session token.
     * Raw session token is never stored in DB.
     */
    private hashSessionToken(token: string): string {
        return crypto.createHash('sha256').update(token.trim()).digest('hex');
    }

    /**
     * Generate Public Human-Readable Checkout Reference e.g. IC-000386
     */
    private async generatePublicCheckoutId(): Promise<string> {
        let attempts = 0;
        while (attempts < 10) {
            const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
            const candidateId = `IC-${randomCode}`;
            const existing = await this.checkoutRepo.findOne({
                where: { publicCheckoutId: candidateId },
            });
            if (!existing) {
                return candidateId;
            }
            attempts++;
        }
        return `IC-${Date.now().toString().slice(-6)}`;
    }

    /**
     * Authoritative Backend Recovery Link & Action State Generator
     */
    private buildRecoveryMeta(item: IncompleteCheckout) {
        const phone = item.customerPhone ? item.customerPhone.trim() : null;
        let whatsappUrl: string | null = null;
        let callUrl: string | null = null;

        if (phone) {
            const waPhone = phone.replace(/^\+/, '');
            const customerGreeting =
                item.customerName && item.customerName !== 'No name yet' ? item.customerName : '';
            const greetingPart = customerGreeting ? ` ${customerGreeting}` : '';
            const message = encodeURIComponent(
                `Assalamu Alaikum${greetingPart}! You recently showed interest in products from our store (${item.publicCheckoutId}). Do you need any assistance to complete your order?`
            );
            whatsappUrl = `https://wa.me/${waPhone}?text=${message}`;
            callUrl = `tel:${phone}`;
        }

        const canConvert =
            item.status !== CheckoutStatus.CONVERTED &&
            item.status !== CheckoutStatus.CANCELLED &&
            Boolean(item.cartItemsSnapshot && item.cartItemsSnapshot.length > 0);
        const canCancel =
            item.status !== CheckoutStatus.CANCELLED && item.status !== CheckoutStatus.CONVERTED;
        const canCall = Boolean(phone) && item.status !== CheckoutStatus.CONVERTED;
        const canWhatsApp = Boolean(phone) && item.status !== CheckoutStatus.CONVERTED;

        return {
            phone,
            callUrl,
            whatsappUrl,
            actions: {
                canConvert,
                canCancel,
                canCall,
                canWhatsApp,
            },
        };
    }

    /**
     * Track or Update Checkout draft from Storefront.
     * Client is NOT trusted for prices or totals; catalog products are re-resolved server-side.
     */
    async trackCheckout(
        dto: TrackCheckoutDto,
        customerId?: string | null
    ): Promise<ApiResponse<any>> {
        if (!dto.sessionToken || dto.sessionToken.trim().length < 8) {
            throw new BadRequestException('Valid sessionToken is required.');
        }

        const tokenHash = this.hashSessionToken(dto.sessionToken);

        // Canonical Bangladesh Phone normalization
        let canonicalPhone: string | null = null;
        if (dto.customer?.phone && dto.customer.phone.trim()) {
            try {
                canonicalPhone = normalizeBDPhone(dto.customer.phone.trim());
            } catch {
                // If invalid during typing, retain trimmed raw or null
                canonicalPhone = dto.customer.phone.trim();
            }
        }

        // Re-resolve items and calculate prices in Minor Units (cents/paisa: BDT x 100)
        const productIds = dto.items.map((it) => it.productId);
        const products =
            productIds.length > 0
                ? await this.productRepo.find({ where: { id: In(productIds) } })
                : [];
        const productMap = new Map(products.map((p) => [p.id, p]));

        const cartSnapshots: CartItemSnapshot[] = [];
        let subtotalMinor = BigInt(0);

        for (const item of dto.items) {
            const product = productMap.get(item.productId);
            if (!product) continue;

            const unitPrice = Number(product.price) || 0;
            const unitPriceMinor = Math.round(unitPrice * 100);
            const qty = Math.max(1, item.quantity);
            const lineSubtotalMinor = unitPriceMinor * qty;

            subtotalMinor += BigInt(lineSubtotalMinor);

            cartSnapshots.push({
                productId: product.id,
                variantId: item.variantId || null,
                sku: item.sku || product.sku || null,
                title: product.name,
                image: product.featuredImage || null,
                unitPriceMinor,
                quantity: qty,
                subtotalMinor: lineSubtotalMinor,
            });
        }

        // Standard delivery charge Minor units (can be resolved from store config, default ৳60 / 6000 minor)
        const deliveryFeeMinor = BigInt(0);
        const discountMinor = BigInt(0);
        const totalMinor = subtotalMinor + deliveryFeeMinor - discountMinor;

        // Atomic Upsert by sessionTokenHash
        let checkout = await this.checkoutRepo.findOne({
            where: { sessionTokenHash: tokenHash },
        });

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days recovery window

        if (checkout) {
            // If already converted or explicitly cancelled, do not mutate state
            if (checkout.status === CheckoutStatus.CONVERTED) {
                return ResponseUtils.successResponseHandler(
                    200,
                    'Checkout already converted to order.',
                    'data',
                    {
                        publicCheckoutId: checkout.publicCheckoutId,
                        status: checkout.status,
                    }
                );
            }

            checkout.customerName = dto.customer?.name?.trim() || checkout.customerName;
            if (canonicalPhone) checkout.customerPhone = canonicalPhone;
            checkout.customerEmail = dto.customer?.email?.trim() || checkout.customerEmail;
            checkout.shippingAddress = dto.customer?.address?.trim() || checkout.shippingAddress;
            checkout.shippingCity = dto.customer?.city?.trim() || checkout.shippingCity;

            if (customerId && !checkout.customerId) {
                checkout.customerId = customerId;
            }

            if (cartSnapshots.length > 0) {
                checkout.cartItemsSnapshot = cartSnapshots;
                checkout.subtotalMinor = subtotalMinor.toString();
                checkout.deliveryFeeMinor = deliveryFeeMinor.toString();
                checkout.discountMinor = discountMinor.toString();
                checkout.totalMinor = totalMinor.toString();
            }

            if (dto.source) checkout.source = dto.source;
            if (dto.utmParams) checkout.utmParams = dto.utmParams;

            // Customer returned & active again
            if (checkout.status === CheckoutStatus.ABANDONED) {
                checkout.status = CheckoutStatus.ACTIVE;
                checkout.abandonedAt = null;
            }

            checkout.lastActivityAt = now;
            await this.checkoutRepo.save(checkout);

            return ResponseUtils.successResponseHandler(200, 'Checkout draft updated.', 'data', {
                publicCheckoutId: checkout.publicCheckoutId,
                status: checkout.status,
                totalMinor: checkout.totalMinor,
            });
        }

        // Create new IncompleteCheckout
        const publicCheckoutId = await this.generatePublicCheckoutId();

        checkout = this.checkoutRepo.create({
            publicCheckoutId,
            sessionTokenHash: tokenHash,
            customerId: customerId || null,
            customerName: dto.customer?.name?.trim() || null,
            customerPhone: canonicalPhone,
            customerEmail: dto.customer?.email?.trim() || null,
            shippingAddress: dto.customer?.address?.trim() || null,
            shippingCity: dto.customer?.city?.trim() || null,
            cartItemsSnapshot: cartSnapshots,
            currency: 'BDT',
            subtotalMinor: subtotalMinor.toString(),
            deliveryFeeMinor: deliveryFeeMinor.toString(),
            discountMinor: discountMinor.toString(),
            totalMinor: totalMinor.toString(),
            source: dto.source || 'Website checkout',
            utmParams: dto.utmParams || null,
            status: CheckoutStatus.ACTIVE,
            startedAt: now,
            lastActivityAt: now,
            expiresAt,
        });

        await this.checkoutRepo.save(checkout);

        return ResponseUtils.successResponseHandler(201, 'Checkout draft created.', 'data', {
            publicCheckoutId: checkout.publicCheckoutId,
            status: checkout.status,
            totalMinor: checkout.totalMinor,
        });
    }

    /**
     * Admin KPI Metrics with Strict Business Definitions
     */
    async getAdminStats(fromDate?: string, toDate?: string): Promise<ApiResponse<any>> {
        const now = new Date();

        // 1. ACTIVE count
        const activeCount = await this.checkoutRepo.count({
            where: { status: CheckoutStatus.ACTIVE, isDeleted: false },
        });

        // 2. ABANDONED (Incomplete) count & Recoverable Value (unexpired)
        const abandonedQuery = this.checkoutRepo
            .createQueryBuilder('c')
            .where('c.status = :status', { status: CheckoutStatus.ABANDONED })
            .andWhere('c.expiresAt > :now', { now })
            .andWhere('c.isDeleted = false');

        const abandonedCount = await abandonedQuery.getCount();

        const recoverableSumResult = await this.checkoutRepo
            .createQueryBuilder('c')
            .select('SUM(c.totalMinor)', 'sumTotal')
            .where('c.status = :status', { status: CheckoutStatus.ABANDONED })
            .andWhere('c.expiresAt > :now', { now })
            .andWhere('c.isDeleted = false')
            .getRawOne();

        const rawSum = recoverableSumResult?.sumTotal;
        const rawSumClean = rawSum != null ? String(rawSum).split('.')[0] : '0';
        const recoverableValueMinor = BigInt(rawSumClean || '0');
        const recoverableValue = Number(recoverableValueMinor) / 100;

        // 3. CONVERTED count (in date range if provided)
        const convertedQuery = this.checkoutRepo
            .createQueryBuilder('c')
            .where('c.status = :status', { status: CheckoutStatus.CONVERTED })
            .andWhere('c.isDeleted = false');

        if (fromDate)
            convertedQuery.andWhere('c.convertedAt >= :fromDate', { fromDate: new Date(fromDate) });
        if (toDate)
            convertedQuery.andWhere('c.convertedAt <= :toDate', { toDate: new Date(toDate) });
        const convertedCount = await convertedQuery.getCount();

        // 4. CANCELLED count
        const cancelledQuery = this.checkoutRepo
            .createQueryBuilder('c')
            .where('c.status = :status', { status: CheckoutStatus.CANCELLED })
            .andWhere('c.isDeleted = false');

        if (fromDate)
            cancelledQuery.andWhere('c.cancelledAt >= :fromDate', { fromDate: new Date(fromDate) });
        if (toDate)
            cancelledQuery.andWhere('c.cancelledAt <= :toDate', { toDate: new Date(toDate) });
        const cancelledCount = await cancelledQuery.getCount();

        // 5. EXPIRED count
        const expiredCount = await this.checkoutRepo.count({
            where: { status: CheckoutStatus.EXPIRED, isDeleted: false },
        });

        return ResponseUtils.successResponseHandler(
            200,
            'Incomplete checkout statistics retrieved.',
            'data',
            {
                activeCount,
                abandonedCount, // This is the "INCOMPLETE" card on the screenshot
                recoverableValue, // Formatted BDT value
                recoverableValueMinor: recoverableValueMinor.toString(),
                convertedCount,
                cancelledCount,
                expiredCount,
            }
        );
    }

    /**
     * Admin Paginated Listing with Search, Status, and Date Range Filters
     */
    async getAdminList(dto: IncompleteCheckoutFilterDto): Promise<ApiResponse<any>> {
        const page = Math.max(1, Number(dto.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(dto.limit) || 20));
        const skip = (page - 1) * limit;

        const qb = this.checkoutRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.customer', 'customer')
            .where('c.isDeleted = false');

        if (dto.status) {
            qb.andWhere('c.status = :status', { status: dto.status });
        }

        if (dto.search && dto.search.trim()) {
            const searchTerm = `%${dto.search.trim()}%`;
            qb.andWhere(
                '(c.publicCheckoutId LIKE :search OR c.customerName LIKE :search OR c.customerPhone LIKE :search OR c.customerEmail LIKE :search OR c.shippingAddress LIKE :search)',
                { search: searchTerm }
            );
        }

        if (dto.fromDate) {
            qb.andWhere('c.lastActivityAt >= :fromDate', { fromDate: new Date(dto.fromDate) });
        }

        if (dto.toDate) {
            qb.andWhere('c.lastActivityAt <= :toDate', { toDate: new Date(dto.toDate) });
        }

        qb.orderBy('c.lastActivityAt', 'DESC');
        qb.skip(skip).take(limit);

        const [items, total] = await qb.getManyAndCount();

        const formattedItems = items.map((item) => {
            const totalMinor = BigInt(item.totalMinor || '0');
            return {
                id: item.id,
                publicCheckoutId: item.publicCheckoutId,
                customer: {
                    name: item.customerName || 'No name yet',
                    phone: item.customerPhone || null,
                    email: item.customerEmail || null,
                    address: item.shippingAddress || null,
                    city: item.shippingCity || null,
                },
                cartItems: item.cartItemsSnapshot || [],
                total: Number(totalMinor) / 100,
                totalMinor: item.totalMinor,
                currency: item.currency,
                source: item.source,
                utmParams: item.utmParams,
                status: item.status,
                startedAt: item.startedAt,
                lastActivityAt: item.lastActivityAt,
                abandonedAt: item.abandonedAt,
                convertedAt: item.convertedAt,
                convertedOrderId: item.convertedOrderId,
                recoveryAttemptCount: item.recoveryAttemptCount,
                recovery: this.buildRecoveryMeta(item),
            };
        });

        return ResponseUtils.successResponseHandler(
            200,
            'Incomplete checkouts retrieved.',
            'data',
            {
                items: formattedItems,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        );
    }

    /**
     * Get Single Incomplete Checkout details + Recovery Activity timeline
     */
    async getCheckoutDetails(id: string): Promise<ApiResponse<any>> {
        const checkout = await this.checkoutRepo.findOne({
            where: [{ id }, { publicCheckoutId: id }],
            relations: [
                'customer',
                'recoveryActivities',
                'recoveryActivities.admin',
                'convertedOrder',
            ],
        });

        if (!checkout) {
            throw new NotFoundException(`Checkout with ID ${id} not found.`);
        }

        const activities = (checkout.recoveryActivities || []).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const totalMinor = BigInt(checkout.totalMinor || '0');

        return ResponseUtils.successResponseHandler(200, 'Checkout details retrieved.', 'data', {
            id: checkout.id,
            publicCheckoutId: checkout.publicCheckoutId,
            customer: {
                name: checkout.customerName || 'No name yet',
                phone: checkout.customerPhone || null,
                email: checkout.customerEmail || null,
                address: checkout.shippingAddress || null,
                city: checkout.shippingCity || null,
            },
            cartItems: checkout.cartItemsSnapshot || [],
            subtotal: Number(BigInt(checkout.subtotalMinor || '0')) / 100,
            deliveryFee: Number(BigInt(checkout.deliveryFeeMinor || '0')) / 100,
            discount: Number(BigInt(checkout.discountMinor || '0')) / 100,
            total: Number(totalMinor) / 100,
            totalMinor: checkout.totalMinor,
            currency: checkout.currency,
            source: checkout.source,
            utmParams: checkout.utmParams,
            status: checkout.status,
            startedAt: checkout.startedAt,
            lastActivityAt: checkout.lastActivityAt,
            abandonedAt: checkout.abandonedAt,
            convertedAt: checkout.convertedAt,
            convertedOrderId: checkout.convertedOrderId,
            convertedOrderNumber: checkout.convertedOrder?.orderId || null,
            recoveryAttemptCount: checkout.recoveryAttemptCount,
            recovery: this.buildRecoveryMeta(checkout),
            activities: activities.map((act) => ({
                id: act.id,
                action: act.action,
                note: act.note,
                adminName: act.admin?.name || 'Staff',
                createdAt: act.createdAt,
            })),
        });
    }

    /**
     * Log Recovery Activity (call_initiated, whatsapp_opened, note_added)
     */
    async logActivity(
        checkoutId: string,
        adminId: string,
        dto: CreateRecoveryActivityDto
    ): Promise<ApiResponse<any>> {
        const checkout = await this.checkoutRepo.findOne({
            where: [{ id: checkoutId }, { publicCheckoutId: checkoutId }],
        });

        if (!checkout) {
            throw new NotFoundException('Checkout not found.');
        }

        const safeAdminId = adminId && adminId.trim() ? adminId : null;
        const activity = this.activityRepo.create({
            checkoutId: checkout.id,
            adminId: safeAdminId,
            action: dto.action,
            note: dto.note?.trim() || null,
        });

        await this.activityRepo.save(activity);

        // Increment recovery attempts for calls and whatsapp
        if (
            dto.action === RecoveryAction.CALL_INITIATED ||
            dto.action === RecoveryAction.WHATSAPP_OPENED
        ) {
            checkout.recoveryAttemptCount = (checkout.recoveryAttemptCount || 0) + 1;
            await this.checkoutRepo.save(checkout);
        }

        return ResponseUtils.successResponseHandler(
            201,
            'Recovery activity recorded.',
            'data',
            activity
        );
    }

    /**
     * Update Status manually (e.g. Cancel or Archive)
     */
    async updateStatus(
        checkoutId: string,
        adminId: string,
        dto: UpdateCheckoutStatusDto
    ): Promise<ApiResponse<any>> {
        const checkout = await this.checkoutRepo.findOne({
            where: [{ id: checkoutId }, { publicCheckoutId: checkoutId }],
        });

        if (!checkout) {
            throw new NotFoundException('Checkout not found.');
        }

        checkout.status = dto.status;
        if (dto.status === CheckoutStatus.CANCELLED) {
            checkout.cancelledAt = new Date();
        }

        await this.checkoutRepo.save(checkout);

        // Record status change activity
        const safeAdminId = adminId && adminId.trim() ? adminId : null;
        const activity = this.activityRepo.create({
            checkoutId: checkout.id,
            adminId: safeAdminId,
            action:
                dto.status === CheckoutStatus.CANCELLED
                    ? RecoveryAction.CANCELLED
                    : RecoveryAction.NOTE_ADDED,
            note: dto.note || `Status manually changed to ${dto.status}`,
        });
        await this.activityRepo.save(activity);

        return ResponseUtils.successResponseHandler(
            200,
            `Checkout marked as ${dto.status}.`,
            'data',
            {
                id: checkout.id,
                status: checkout.status,
            }
        );
    }

    /**
     * Admin Convert to Official Order.
     * Revalidates stock and pricing, and invokes existing OrderService.create()
     */
    async convertToOrder(checkoutId: string, adminId: string): Promise<ApiResponse<any>> {
        const checkout = await this.checkoutRepo.findOne({
            where: [{ id: checkoutId }, { publicCheckoutId: checkoutId }],
            relations: ['customer'],
        });

        if (!checkout) {
            throw new NotFoundException('Checkout not found.');
        }

        if (checkout.status === CheckoutStatus.CONVERTED) {
            throw new HttpException(
                'This checkout has already been converted to an order.',
                HttpStatus.CONFLICT
            );
        }

        if (!checkout.cartItemsSnapshot || checkout.cartItemsSnapshot.length === 0) {
            throw new BadRequestException('Checkout has no items to create an order.');
        }

        // Authoritative Server-side Stock Re-validation:
        // Ensure products have not been depleted or deleted since checkout abandonment
        for (const it of checkout.cartItemsSnapshot) {
            const product = await this.productRepo.findOne({ where: { id: it.productId } });
            if (!product || product.isDeleted) {
                throw new BadRequestException(
                    `Cannot convert checkout: Product '${it.title}' is no longer active in catalog.`
                );
            }
            if (Number(product.quantity || 0) < it.quantity) {
                throw new BadRequestException(
                    `Cannot convert checkout: Product '${it.title}' has insufficient stock (Available: ${product.quantity}, Required: ${it.quantity}).`
                );
            }
        }

        // Format items for CreateOrdersDto
        const orderItems = checkout.cartItemsSnapshot.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.unitPriceMinor / 100,
            productName: item.title,
        }));

        const createOrderDto: CreateOrdersDto = {
            items: orderItems,
            phone: checkout.customerPhone || undefined,
            address: checkout.shippingAddress || 'Not specified',
            shippingAddress: {
                name: checkout.customerName || 'Customer',
                phone: checkout.customerPhone || '',
                address: checkout.shippingAddress || '',
                city: checkout.shippingCity || 'Dhaka',
            },
            paymentMethod: 'COD',
            specialNote: `Converted from Incomplete Checkout ${checkout.publicCheckoutId}`,
            idempotencyKey: `convert_${checkout.id}_${Date.now()}`,
        };

        // Create official order using existing OrderService
        const orderResult = await this.ordersService.create(
            createOrderDto,
            checkout.customerId || adminId
        );

        const newOrder = (orderResult as any)?.data;
        const newOrderId = newOrder?.id || newOrder?.orderId;

        // Atomically update checkout status
        checkout.status = CheckoutStatus.CONVERTED;
        checkout.convertedOrderId = newOrderId;
        checkout.convertedAt = new Date();
        await this.checkoutRepo.save(checkout);

        // Record conversion activity
        const safeAdminId = adminId && adminId.trim() ? adminId : null;
        const activity = this.activityRepo.create({
            checkoutId: checkout.id,
            adminId: safeAdminId,
            action: RecoveryAction.CONVERTED,
            note: `Successfully converted to Order #${newOrder?.orderId || newOrderId}`,
        });
        await this.activityRepo.save(activity);

        return ResponseUtils.successResponseHandler(
            201,
            'Checkout converted to official order.',
            'data',
            {
                order: newOrder,
                publicCheckoutId: checkout.publicCheckoutId,
            }
        );
    }
}
