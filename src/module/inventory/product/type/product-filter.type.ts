import { FindOperator } from "typeorm";
import { DiscountType } from "../../../../enums/product.enum";

export interface ProductFilter {
    name?: string | FindOperator<string>;
    status?: boolean;
    isApprove?: boolean;
    sku?: string | FindOperator<string>;
    mainCategoryId?: string;
    firstCategoryId?: string;
    secondCategoryId?: string;
    vendorId?: string;
    discountType?: DiscountType | FindOperator<DiscountType>;
    discountAmount?: number | FindOperator<number>;
    price?: number | FindOperator<number>;
    quantity?: number | FindOperator<number>;
    createdAt?: Date | FindOperator<Date>;
}