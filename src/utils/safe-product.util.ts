import { Product } from "src/module/inventory/product/entities/product.entity";

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
    isProductSectionOne: boolean;
    isProductSectionTwo: boolean;
    isProductSectionThree: boolean;
    isProductSectionFour: boolean;
    isProductSectionFive: boolean;
    isProductSectionSix: boolean;
}

export function toSafeProduct(product: Product): SafeProduct {
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
        isProductSectionOne,
        isProductSectionTwo,
        isProductSectionThree,
        isProductSectionFour,
        isProductSectionFive,
        isProductSectionSix
    } = product;

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
        isProductSectionOne,
        isProductSectionTwo,
        isProductSectionThree,
        isProductSectionFour,
        isProductSectionFive,
        isProductSectionSix
    };
}
