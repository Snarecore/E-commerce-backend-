import { Product } from "../module/inventory/product/entities/product.entity";
import { resolveEffectiveProductPrice, MegaDiscountState } from "./pricing-resolver.util";

export interface SafeProduct {
    id: string;
    name: string;
    slug: string;
    sku: string;
    featuredImage: string | null;
    description: string | null;
    videoUrl: string | null;
    summary: string | null;
    price: number;
    cost: number | null;
    discountType: string | null;
    discountAmount: number | null;
    mainCategoryId: string;
    mainCategoryName: string;
    firstCategoryId: string | null;
    firstCategoryName: string | null;
    secondCategoryId: string | null;
    secondCategoryName: string | null;
    vendorId: string;
    vendorName: string;
    rating: number | null;
    status: boolean;
    isApprove: boolean;
    sizesString: string | null;
    sizeStock: Record<string, number> | null;
    quantity: number;
    isProductSectionOne: boolean;
    isProductSectionTwo: boolean;
    isProductSectionThree: boolean;
    isProductSectionFour: boolean;
    isProductSectionFive: boolean;
    isProductSectionSix: boolean;
}

export function toSafeProduct(product: Product, megaDiscount?: MegaDiscountState | null): SafeProduct {
    const {
        id,
        name,
        slug,
        sku,
        featuredImage,
        description,
        videoUrl,
        summary,
        price,
        cost,
        discountType,
        discountAmount,
        mainCategoryId,
        mainCategoryName,
        firstCategoryId,
        firstCategoryName,
        secondCategoryId,
        secondCategoryName,
        vendorId,
        vendorName,
        rating,
        status,
        isApprove,
        sizesString,
        sizeStock,
        quantity,
        isProductSectionOne,
        isProductSectionTwo,
        isProductSectionThree,
        isProductSectionFour,
        isProductSectionFive,
        isProductSectionSix
    } = product;

    const resolved = resolveEffectiveProductPrice({ price, discountType, discountAmount }, megaDiscount);

    return {
        id,
        name,
        slug,
        sku,
        featuredImage,
        description,
        videoUrl,
        summary,
        price,
        cost,
        discountType: resolved.discountType,
        discountAmount: resolved.discountAmount,
        mainCategoryId,
        mainCategoryName,
        firstCategoryId,
        firstCategoryName,
        secondCategoryId,
        secondCategoryName,
        vendorId,
        vendorName,
        rating,
        status,
        isApprove,
        sizesString,
        sizeStock,
        quantity,
        isProductSectionOne,
        isProductSectionTwo,
        isProductSectionThree,
        isProductSectionFour,
        isProductSectionFive,
        isProductSectionSix
    };
}
