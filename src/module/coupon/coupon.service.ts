import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { CouponRepository } from './coupon.repository';
import { CouponUsageRepository } from './coupon-usage.repository';
import { ProductRepository } from '../inventory/product/product.repository';
import { Coupon } from './entity/coupon.entity';
import { CouponUsage } from './entity/coupon-usage.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CouponDiscountType } from 'src/enums/coupon.enum';

@Injectable()
export class CouponService implements OnModuleInit {
    constructor(
        private readonly couponRepository: CouponRepository,
        private readonly couponUsageRepository: CouponUsageRepository,
        private readonly productRepository: ProductRepository
    ) {}

    async onModuleInit() {
        // Auto-create MySQL schema for coupon and coupon_usage if missing
        try {
            await (this.couponRepository as any).query(`
                CREATE TABLE IF NOT EXISTS \`coupon\` (
                    \`id\` varchar(255) NOT NULL,
                    \`code\` varchar(255) NOT NULL,
                    \`description\` text NULL,
                    \`discountType\` enum('PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING') NOT NULL DEFAULT 'PERCENTAGE',
                    \`discountValue\` decimal(10,2) NOT NULL DEFAULT '0.00',
                    \`minOrderAmount\` decimal(10,2) NOT NULL DEFAULT '0.00',
                    \`maxDiscountAmount\` decimal(10,2) NULL,
                    \`startDate\` datetime NULL,
                    \`endDate\` datetime NULL,
                    \`usageLimit\` int NULL,
                    \`userUsageLimit\` int NOT NULL DEFAULT '1',
                    \`usageCount\` int NOT NULL DEFAULT '0',
                    \`isActive\` tinyint NOT NULL DEFAULT '1',
                    \`isDeleted\` tinyint NOT NULL DEFAULT '0',
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (\`id\`),
                    UNIQUE KEY \`UQ_coupon_code\` (\`code\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        } catch (e) {}

        try {
            await (this.couponRepository as any).query(`
                CREATE TABLE IF NOT EXISTS \`coupon_usage\` (
                    \`id\` varchar(255) NOT NULL,
                    \`couponId\` varchar(255) NOT NULL,
                    \`userId\` varchar(255) NOT NULL,
                    \`orderId\` varchar(255) NOT NULL,
                    \`discountAmount\` decimal(10,2) NOT NULL,
                    \`usedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`isDeleted\` tinyint NOT NULL DEFAULT '0',
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (\`id\`),
                    KEY \`IDX_coupon_user\` (\`couponId\`,\`userId\`),
                    KEY \`IDX_coupon_order\` (\`couponId\`,\`orderId\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        } catch (e) {}

        try {
            await (this.couponRepository as any).query(`ALTER TABLE \`orders\` ADD COLUMN \`couponId\` varchar(255) NULL`);
        } catch (e) {}
        try {
            await (this.couponRepository as any).query(`ALTER TABLE \`orders\` ADD COLUMN \`couponCode\` varchar(255) NULL`);
        } catch (e) {}
        try {
            await (this.couponRepository as any).query(`ALTER TABLE \`orders\` ADD COLUMN \`discountAmount\` decimal(10,2) NOT NULL DEFAULT '0.00'`);
        } catch (e) {}
    }

    private roundTwoDecimals(num: number): number {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    evaluateCouponDiscount(coupon: Coupon, subtotal: number, deliveryCharge: number): number {
        let discount = 0;
        if (coupon.discountType === CouponDiscountType.PERCENTAGE) {
            discount = subtotal * (Number(coupon.discountValue || 0) / 100);
            if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
                discount = Math.min(discount, Number(coupon.maxDiscountAmount));
            }
        } else if (coupon.discountType === CouponDiscountType.FIXED_AMOUNT) {
            discount = Math.min(Number(coupon.discountValue || 0), subtotal);
        } else if (coupon.discountType === CouponDiscountType.FREE_SHIPPING) {
            discount = deliveryCharge;
        }
        return this.roundTwoDecimals(discount);
    }

    async calculateCouponPreview(dto: ValidateCouponDto, userId?: string): Promise<ApiResponse<any>> {
        const normalizedCode = dto.code.trim().toUpperCase();
        const coupon = await this.couponRepository.findOneByQuery({ code: normalizedCode, isActive: true });

        if (!coupon || coupon.isDeleted) {
            throw new HttpException('Invalid or expired coupon code.', HttpStatus.BAD_REQUEST);
        }

        const now = new Date();
        if (coupon.startDate && new Date(coupon.startDate) > now) {
            throw new HttpException('Coupon is not active yet.', HttpStatus.BAD_REQUEST);
        }
        if (coupon.endDate && new Date(coupon.endDate) < now) {
            throw new HttpException('Coupon code has expired.', HttpStatus.BAD_REQUEST);
        }

        if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
            throw new HttpException('Coupon usage limit has been reached.', HttpStatus.BAD_REQUEST);
        }

        // Calculate server subtotal & shipping
        let serverSubtotal = 0;
        for (const item of dto.items || []) {
            const product = await this.productRepository.findOne(item.productId);
            if (product) {
                const price = Number(product.price || 0);
                serverSubtotal += price * item.quantity;
            }
        }

        if (coupon.minOrderAmount && serverSubtotal < Number(coupon.minOrderAmount)) {
            throw new HttpException(
                `Minimum order amount of ৳${coupon.minOrderAmount} required for this coupon.`,
                HttpStatus.BAD_REQUEST
            );
        }

        if (userId && coupon.userUsageLimit && coupon.userUsageLimit > 0) {
            const userUsages = await this.couponUsageRepository.count({
                couponId: coupon.id,
                userId: userId
            });
            if (userUsages >= coupon.userUsageLimit) {
                throw new HttpException('You have reached your maximum usage limit for this coupon.', HttpStatus.BAD_REQUEST);
            }
        }

        const deliveryCharge = (dto.deliveryZone || '').toLowerCase().includes('dhaka') ? 60 : 120;
        const discountAmount = this.evaluateCouponDiscount(coupon, serverSubtotal, deliveryCharge);
        const finalTotal = this.roundTwoDecimals(Math.max(0, serverSubtotal + deliveryCharge - discountAmount));

        return ResponseUtils.successResponseHandler(200, 'Coupon applied successfully.', 'data', {
            valid: true,
            couponId: coupon.id,
            couponCode: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            subtotal: this.roundTwoDecimals(serverSubtotal),
            deliveryCharge,
            discountAmount,
            finalTotal
        });
    }

    async redeemCouponInTransaction(
        queryRunner: QueryRunner,
        code: string,
        serverSubtotal: number,
        deliveryCharge: number,
        userId: string,
        orderId: string
    ): Promise<{ couponId: string; couponCode: string; discountAmount: number }> {
        const normalizedCode = code.trim().toUpperCase();

        // 1. Lock Coupon row FOR UPDATE
        const coupon = await queryRunner.manager
            .createQueryBuilder(Coupon, 'coupon')
            .where('coupon.code = :code', { code: normalizedCode })
            .andWhere('coupon.isActive = :isActive', { isActive: true })
            .andWhere('coupon.isDeleted = :isDeleted', { isDeleted: false })
            .setLock('pessimistic_write')
            .getOne();

        if (!coupon) {
            throw new HttpException('Coupon code is invalid, expired, or unavailable.', HttpStatus.CONFLICT);
        }

        const now = new Date();
        if (coupon.startDate && new Date(coupon.startDate) > now) {
            throw new HttpException('Coupon is not active yet.', HttpStatus.CONFLICT);
        }
        if (coupon.endDate && new Date(coupon.endDate) < now) {
            throw new HttpException('Coupon has expired.', HttpStatus.CONFLICT);
        }

        if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
            throw new HttpException('Coupon usage limit has been reached. Please remove coupon and try again.', HttpStatus.CONFLICT);
        }

        if (coupon.minOrderAmount && serverSubtotal < Number(coupon.minOrderAmount)) {
            throw new HttpException(`Minimum order subtotal of ৳${coupon.minOrderAmount} required for this coupon.`, HttpStatus.CONFLICT);
        }

        // 2. Locked User Usage Check
        if (userId && coupon.userUsageLimit && coupon.userUsageLimit > 0) {
            const userUsageCount = await queryRunner.manager.count(CouponUsage, {
                where: { couponId: coupon.id, userId: userId }
            });
            if (userUsageCount >= coupon.userUsageLimit) {
                throw new HttpException('You have reached your maximum usage limit for this coupon.', HttpStatus.CONFLICT);
            }
        }

        // 3. Calculate Server Discount
        const discountAmount = this.evaluateCouponDiscount(coupon, serverSubtotal, deliveryCharge);

        // 4. Create CouponUsage Record
        const couponUsage = queryRunner.manager.create(CouponUsage, {
            couponId: coupon.id,
            userId,
            orderId,
            discountAmount
        } as any);
        await queryRunner.manager.save(couponUsage);

        // 5. Increment usageCount
        coupon.usageCount = (coupon.usageCount || 0) + 1;
        await queryRunner.manager.save(coupon);

        return {
            couponId: coupon.id,
            couponCode: coupon.code,
            discountAmount
        };
    }

    // Admin CRUD Operations
    async create(dto: CreateCouponDto): Promise<ApiResponse<Coupon>> {
        const normalizedCode = dto.code.trim().toUpperCase();
        const existing = await this.couponRepository.findOneByQuery({ code: normalizedCode });

        if (existing) {
            throw new HttpException('Coupon code already exists.', HttpStatus.BAD_REQUEST);
        }

        if (dto.startDate && dto.endDate && new Date(dto.startDate) >= new Date(dto.endDate)) {
            throw new HttpException('End date must be after start date.', HttpStatus.BAD_REQUEST);
        }

        const coupon = await this.couponRepository.create({
            ...dto,
            code: normalizedCode,
            minOrderAmount: dto.minOrderAmount || 0,
            discountValue: dto.discountValue || 0,
            usageLimit: dto.usageLimit ? dto.usageLimit : null,
            userUsageLimit: dto.userUsageLimit ? dto.userUsageLimit : null,
            isActive: dto.isActive !== undefined ? dto.isActive : true
        } as any);

        return ResponseUtils.successResponseHandler(201, 'Coupon created successfully.', 'data', coupon);
    }

    async findAll(page = 1, limit = 10, search?: string): Promise<ApiResponse<any>> {
        const queryBuilder = this.couponRepository;
        const result = await queryBuilder.paginate({
            page,
            limit,
            order: { createdAt: 'DESC' }
        });

        return ResponseUtils.successResponseHandler(200, 'Coupons fetched successfully.', 'data', result);
    }

    async findOne(id: string): Promise<ApiResponse<Coupon>> {
        const coupon = await this.couponRepository.findOne(id);
        if (!coupon || coupon.isDeleted) {
            throw new HttpException('Coupon not found.', HttpStatus.NOT_FOUND);
        }
        return ResponseUtils.successResponseHandler(200, 'Coupon details fetched.', 'data', coupon);
    }

    async update(id: string, dto: UpdateCouponDto): Promise<ApiResponse<Coupon>> {
        const coupon = await this.couponRepository.findOne(id);
        if (!coupon || coupon.isDeleted) {
            throw new HttpException('Coupon not found.', HttpStatus.NOT_FOUND);
        }

        if (dto.usageLimit !== undefined && dto.usageLimit !== null && dto.usageLimit < coupon.usageCount) {
            throw new HttpException(
                `Usage limit cannot be set below current usages count (${coupon.usageCount}).`,
                HttpStatus.BAD_REQUEST
            );
        }

        if (dto.code) {
            const normalizedCode = dto.code.trim().toUpperCase();
            if (normalizedCode !== coupon.code) {
                const existing = await this.couponRepository.findOneByQuery({ code: normalizedCode });
                if (existing) {
                    throw new HttpException('Coupon code already in use.', HttpStatus.BAD_REQUEST);
                }
                dto.code = normalizedCode;
            }
        }

        const updatePayload: any = { ...dto };
        if ('usageLimit' in dto) {
            updatePayload.usageLimit = dto.usageLimit ? dto.usageLimit : null;
        }
        if ('userUsageLimit' in dto) {
            updatePayload.userUsageLimit = dto.userUsageLimit ? dto.userUsageLimit : null;
        }

        const updated = await this.couponRepository.update(id, updatePayload);
        return ResponseUtils.successResponseHandler(200, 'Coupon updated successfully.', 'data', updated!);
    }

    async softDelete(id: string): Promise<ApiResponse<null>> {
        const coupon = await this.couponRepository.findOne(id);
        if (!coupon) {
            throw new HttpException('Coupon not found.', HttpStatus.NOT_FOUND);
        }
        await this.couponRepository.softDelete(id);
        return ResponseUtils.successResponseHandler(200, 'Coupon deleted successfully.', 'data', null);
    }
}
