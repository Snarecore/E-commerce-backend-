import { FindOperator } from "typeorm";

export interface ProductFilter {
    name?: string | FindOperator<string>;
    status?: boolean;
    isApprove?: boolean;
    sku?: string | FindOperator<string>;
    mainCategoryId?: string;
    firstCategoryId?: string;
    secondCategoryId?: string;
    thirdCategoryId?: string;
    vendorId?: string;
    createdAt?: Date | FindOperator<Date>;
}