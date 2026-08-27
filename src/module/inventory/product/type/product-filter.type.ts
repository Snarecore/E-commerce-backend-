import { FindOperator } from "typeorm";
import { DiscountType } from "src/enums/product.enum";

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
    createdAt?: Date | FindOperator<Date>;
}