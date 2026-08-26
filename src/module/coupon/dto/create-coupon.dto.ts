import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CouponDiscountType } from 'src/enums/coupon.enum';

export class CreateCouponDto {
    @IsNotEmpty()
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
    code: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty()
    @IsEnum(CouponDiscountType)
    discountType: CouponDiscountType;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    discountValue: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minOrderAmount?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    maxDiscountAmount?: number;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    startDate?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    endDate?: Date;

    @IsOptional()
    @IsInt()
    @Min(1)
    usageLimit?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    userUsageLimit?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
