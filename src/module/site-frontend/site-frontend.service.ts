import { HttpException, HttpStatus, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ResponseUtils } from '../../utils/response.utils';
import { MainCategoryRepository } from "../inventory/main-category/main-category.repository";
import { FirstCategoryRepository } from "../inventory/first-category/first-category.repository";
import { SecondCategoryRepository } from "../inventory/second-category/second-category.repository";
import { HeroSliderRepository } from "../setting/hero-slider/hero-slider.repository";
import { PromotionsRepository } from "../setting/promotions/promotions.repository";
import { ProductRepository } from "../inventory/product/product.repository";
import { FindOptionsOrder, In, Not } from 'typeorm';
import { MegaDiscountRepository } from "../setting/mega-discount/mega-discount.repository";
import { Product } from "../inventory/product/entities/product.entity";
import { ProductFilter } from "../inventory/product/type/product-filter.type";
import { ProductFilterDto } from "../inventory/product/dto/product-filter.dto";
import { ProductImageGalleryRepository } from "../inventory/product-image-gallery/product-image-gallery.repository";
import { FaqRepository } from '../setting/faq/faq.repository';
import { ILike } from 'typeorm';
import { ShopPageCmsRepository } from "../setting/shop/shop-page-cms/shop-page-cms.repository";
import { HomePageCmsRepository } from "../setting/home/home-page-cms/home-page-cms.repository";
import { HeaderFooterCmsRepository } from "../setting/header-footer-cms/header-footer-cms.repository";
import { OrdersRepository } from "../order/order.repository";
import { UserRepository } from "../user/user.repository";
import { Role } from "../../enums/role.enum";
import { DiscountType } from "../../enums/product.enum";
import { Orders } from "../order/entity/order.entity";
import { SocialLinkRepository } from "../setting/social-link/social-link.repository";
import { HeroSlider } from "../setting/hero-slider/entities/hero-slider.entity";
import { Promotions } from "../setting/promotions/entities/promotions.entity";
import { FirstCategory } from "../inventory/first-category/entities/first-category.entity";
import { UserFilterDto } from "../user/dto/user-filter.dto";
import { UserFilter } from "../user/type/user-filter.type";
import { ProductReviewRepository } from "../inventory/product-review/product-review.repository";
import { OrderSummaryRepository } from "../order-summary/order-summary.repository";
import { UserProfileRepository } from "../user-profile/user-profile.repository";
import { toSafeUser } from "../../utils/safe-user.utils";
import { PageMetaRepository } from "../seo/page-meta/page-meta.repository";
import { VendorMessageRepository } from "../setting/vendor-message/vendor-message.repository";
import { toSafeProduct } from "../../utils/safe-product.util";
import { ProductSeoRepository } from "../seo/product-meta/product-seo.repository";
import { omit, omitMany } from "../../utils/helper.utils";

@Injectable()
export class SiteFrontendService {
    constructor(
        private readonly mainCategoryRepository: MainCategoryRepository,
        private readonly firstCategoryRepository: FirstCategoryRepository,
        private readonly secondCategoryRepository: SecondCategoryRepository,
        private readonly heroSliderRepository: HeroSliderRepository,
        private readonly promotionsRepository: PromotionsRepository,
        private readonly productRepository: ProductRepository,
        private readonly productImageGalleryRepository: ProductImageGalleryRepository,
        private readonly faqRepository: FaqRepository,
        private readonly shopPageCmsRepository: ShopPageCmsRepository,
        private readonly homePageCmsRepository: HomePageCmsRepository,
        private readonly headerFooterCmsRepository: HeaderFooterCmsRepository,
        private readonly ordersRepository: OrdersRepository,
        private readonly userRepository: UserRepository,
        private readonly socialLinkRepository: SocialLinkRepository,
        private readonly productReviewRepository: ProductReviewRepository,
        private readonly orderSummaryRepository: OrderSummaryRepository,
        private readonly userProfileRepository: UserProfileRepository,
        private readonly pageMetaRepository: PageMetaRepository,
        private readonly vendorMessageRepository: VendorMessageRepository,
        private readonly productSeoRepository: ProductSeoRepository,
        private readonly megaDiscountRepository: MegaDiscountRepository
    ) { }

    async getMainCategoryData() {
        try {
            const mainCategory = await this.mainCategoryRepository.findAllWithOrder(
                { status: true },
                { position: 'asc', createdAt: 'desc' }
            );

            const data = {
                mainCategory: mainCategory ?? []
            }

            return ResponseUtils.successResponseHandler(200, 'Data fetched successfully', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async getFirstCategoryByMainCategoryId(mainCategoryId: string) {
        try {
            const order: FindOptionsOrder<FirstCategory> = {
                position: 'asc',
                createdAt: 'desc'
            };
            const firstCategories = await this.firstCategoryRepository.findAllWithOrder({
                status: true,
                mainCategoryId: mainCategoryId
            }, order);

            const data = {
                firstCategories: firstCategories ?? []
            };

            return ResponseUtils.successResponseHandler(200, 'Data fetched successfully', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async getSecondCategoryByFirstCategoryId(firstCategoryId: string) {
        try {
            const secondCategories = await this.secondCategoryRepository.findAllWithOrder(
                { status: true, firstCategoryId: firstCategoryId },
                { position: 'asc', createdAt: 'desc' }
            );

            const data = {
                secondCategories: secondCategories ?? []
            };

            return ResponseUtils.successResponseHandler(200, 'Data fetched successfully', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async getHomePageData() {
        try {
            const order: FindOptionsOrder<HeroSlider> = {
                createdAt: 'desc'
            };

            const sort: FindOptionsOrder<Promotions> = {
                createdAt: 'desc'
            };

            const firstCategoryOrder: FindOptionsOrder<FirstCategory> = {
                position: 'asc',
                createdAt: 'desc'
            };

            const [
                contentData,
                heroSlider,
                promotions,
                featuredCategories,
                sectionOneProducts,
                sectionTwoProducts,
                sectionThreeProducts,
                sectionFourProducts,
                sectionFiveProducts,
                sectionSixProducts,
                megaDiscount
            ] = await Promise.all([
                this.homePageCmsRepository.findAll(),
                this.heroSliderRepository.findAllWithOrder({ status: true }, order),
                this.promotionsRepository.findAllWithOrder({ status: true }, sort),
                this.firstCategoryRepository.findAllWithOrder({ showOnHome: true, status: true }, firstCategoryOrder),
                this.productRepository.findByQueryWithHardLimit({ isProductSectionOne: true, status: true }, 10),
                this.productRepository.findByQueryWithHardLimit({ isProductSectionTwo: true, status: true }, 10),
                this.productRepository.findByQueryWithHardLimit({ isProductSectionThree: true, status: true }, 10),
                this.productRepository.findByQueryWithHardLimit({ isProductSectionFour: true, status: true }, 10),
                this.productRepository.findByQueryWithHardLimit({ isProductSectionFive: true, status: true }, 10),
                this.productRepository.findByQueryWithHardLimit({ isProductSectionSix: true, status: true }, 10),
                this.megaDiscountRepository.getSingleton()
            ]);

            const filteredContentData = omit(contentData[0] ?? {}, [
                'id',
                'createdAt',
                'updatedAt',
                'isDeleted'
            ]);

            const filteredHeroSlider = omitMany(heroSlider ?? [], [
                'createdAt',
                'updatedAt',
                'isDeleted'
            ]);

            const filteredPromotions = omitMany(promotions ?? [], [
                'createdAt',
                'updatedAt',
                'isDeleted'
            ]);

            const filteredFeaturedCategories = omitMany(featuredCategories ?? [], [
                'createdAt',
                'updatedAt',
                'isDeleted'
            ]);

            const allSectionProducts = [
                ...(sectionOneProducts ?? []),
                ...(sectionTwoProducts ?? []),
                ...(sectionThreeProducts ?? []),
                ...(sectionFourProducts ?? []),
                ...(sectionFiveProducts ?? []),
                ...(sectionSixProducts ?? [])
            ];

            const productIds = Array.from(new Set(allSectionProducts.map((p) => p?.id).filter(Boolean)));
            const allGalleryImages = productIds.length > 0
                ? await this.productImageGalleryRepository.findAll({ productId: In(productIds) })
                : [];

            const imagesByProductMap = new Map<string, any[]>();
            for (const img of allGalleryImages) {
                const list = imagesByProductMap.get(img.productId) || [];
                list.push(img);
                imagesByProductMap.set(img.productId, list);
            }

            const formatProduct = (p: Product) => {
                const pImages = imagesByProductMap.get(p.id) || [];
                const safe = toSafeProduct(p, megaDiscount);
                const featured = safe.featuredImage || pImages[0]?.imageUrl || null;
                return {
                    ...safe,
                    featuredImage: featured,
                    productImages: pImages
                };
            };

            const data = {
                contentData: filteredContentData,
                heroSlider: filteredHeroSlider,
                promotions: filteredPromotions,
                featuredCategories: filteredFeaturedCategories ?? [],
                sectionOneProducts: sectionOneProducts.map(formatProduct) ?? [],
                sectionTwoProducts: sectionTwoProducts.map(formatProduct) ?? [],
                sectionThreeProducts: sectionThreeProducts.map(formatProduct) ?? [],
                sectionFourProducts: sectionFourProducts.map(formatProduct) ?? [],
                sectionFiveProducts: sectionFiveProducts.map(formatProduct) ?? [],
                sectionSixProducts: sectionSixProducts.map(formatProduct) ?? []
            }

            return ResponseUtils.successResponseHandler(200, 'Data fetched successfully', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async getCartPageData() {
        try {
            const [recommendedProductsRaw, megaDiscount] = await Promise.all([
                this.productRepository.findAll({
                    isProductSectionTwo: true,
                    status: true
                }),
                this.megaDiscountRepository.getSingleton()
            ]);

            const recommendedProducts = recommendedProductsRaw.map((p) => toSafeProduct(p, megaDiscount));

            const data = {
                recommendedProducts
            };

            return ResponseUtils.successResponseHandler(200, 'Data fetched successfully', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async getShopPageData() {
        try {
            const [
                cmsData
            ] = await Promise.all([
                this.shopPageCmsRepository.findAll()
            ]);

            const metaKeys = ['createdAt', 'updatedAt', 'isDeleted'] as const;

            const data = {
                cmsData: omit(cmsData[0], [...metaKeys]) ?? {}
            }

            return ResponseUtils.successResponseHandler(200, 'Data fetched successfully', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async findProductList(dto: ProductFilterDto) {
        try {
            const megaDiscount = await this.megaDiscountRepository.getSingleton();
            const page = dto.page ? Number(dto.page) : 1;
            const limit = dto.limit ? Number(dto.limit) : 10;
            const skip = (page - 1) * limit;

            const qb = this.productRepository.createQueryBuilder('product')
                .where('product.isDeleted = false')
                .andWhere('product.status = true')
                .andWhere('product.isApprove = true');

            if (dto.mainCategoryId) {
                qb.andWhere('product.mainCategoryId = :mainCategoryId', { mainCategoryId: dto.mainCategoryId });
            }

            if (dto.firstCategoryId) {
                qb.andWhere('product.firstCategoryId = :firstCategoryId', { firstCategoryId: dto.firstCategoryId });
            }

            if (dto.secondCategoryId) {
                qb.andWhere('product.secondCategoryId = :secondCategoryId', { secondCategoryId: dto.secondCategoryId });
            }

            if (dto.searchKeyword) {
                qb.andWhere('product.name LIKE :searchKeyword', { searchKeyword: `%${dto.searchKeyword}%` });
            }

            if (dto.inStockOnly) {
                qb.andWhere('product.quantity > 0');
            }

            if (dto.discountOnly) {
                if (!megaDiscount?.isActive) {
                    qb.andWhere('product.discountType != :none', { none: DiscountType.NONE });
                }
            }

            const isMegaActive = Boolean(megaDiscount?.isActive && Number(megaDiscount.discountPercentage) > 0);
            const megaPct = isMegaActive ? Number(megaDiscount.discountPercentage) : 0;

            const effectivePriceSql = isMegaActive
                ? `(product.price * (1 - ${megaPct} / 100))`
                : `(
                    CASE 
                        WHEN product.discountType = 'PERCENT' THEN (product.price * (1 - COALESCE(product.discountAmount, 0) / 100))
                        WHEN product.discountType = 'FLAT' THEN GREATEST(0, product.price - COALESCE(product.discountAmount, 0))
                        ELSE product.price
                    END
                )`;

            const minP = (dto.minPrice !== undefined && !isNaN(Number(dto.minPrice))) ? Number(dto.minPrice) : undefined;
            const maxP = (dto.maxPrice !== undefined && !isNaN(Number(dto.maxPrice))) ? Number(dto.maxPrice) : undefined;

            if (minP !== undefined && maxP !== undefined) {
                qb.andWhere(`${effectivePriceSql} >= :minP AND ${effectivePriceSql} <= :maxP`, { minP, maxP });
            } else if (minP !== undefined) {
                qb.andWhere(`${effectivePriceSql} >= :minP`, { minP });
            } else if (maxP !== undefined) {
                qb.andWhere(`${effectivePriceSql} <= :maxP`, { maxP });
            }

            if (dto.sortBy === 'price_asc') {
                qb.addSelect(effectivePriceSql, 'effective_price');
                qb.orderBy('effective_price', 'ASC');
            } else if (dto.sortBy === 'price_desc') {
                qb.addSelect(effectivePriceSql, 'effective_price');
                qb.orderBy('effective_price', 'DESC');
            } else if (dto.sortBy === 'name_asc') {
                qb.orderBy('product.name', 'ASC');
            } else if (dto.sortBy === 'name_desc') {
                qb.orderBy('product.name', 'DESC');
            } else {
                qb.orderBy('product.createdAt', 'DESC');
            }

            qb.skip(skip).take(limit);

            const [products, total] = await qb.getManyAndCount();
            const pageCount = Math.ceil(total / limit);

            const productIds = products.map((p) => p.id);
            const allImages = productIds.length > 0
                ? await this.productImageGalleryRepository.findAll({ productId: In(productIds) })
                : [];

            const imagesByProductMap = new Map<string, any[]>();
            for (const img of allImages) {
                const list = imagesByProductMap.get(img.productId) || [];
                list.push(img);
                imagesByProductMap.set(img.productId, list);
            }

            const safeData = products.map((p) => {
                const pImages = imagesByProductMap.get(p.id) || [];
                const safe = toSafeProduct(p, megaDiscount);
                return { ...safe, productImages: pImages };
            });

            const payload = {
                data: safeData,
                total,
                page,
                limit,
                pageCount
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async findProductListWithHardLimit(dto: ProductFilterDto) {
        try {
            const megaDiscount = await this.megaDiscountRepository.getSingleton();
            let query: ProductFilter = {};

            if (dto.discountOnly) {
                if (!megaDiscount.isActive) {
                    query.discountType = Not(DiscountType.NONE);
                }
            }

            query.status = true;

            const order: FindOptionsOrder<Product> = {
                createdAt: 'desc'
            };

            const result = await this.productRepository.paginateWithHardLimit({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                maxTotal: dto.maxTotal ? dto?.maxTotal : 50,
                query,
                order
            });

            const safeData = result.data.map((p) => toSafeProduct(p, megaDiscount));

            const payload = {
                data: safeData,
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async getProductReviewData(productId: string) {
        const data = await this.productReviewRepository.findAll({ productId: productId });

        const reviewCount = data.length;

        if (reviewCount === 0) {
            return {
                data: [],
                reviewCount: 0,
                ratingAverage: 0,
                countOneStartRating: 0,
                countTwoStartRating: 0,
                countThreeStartRating: 0,
                countFourStartRating: 0,
                countFiveStartRating: 0
            };
        }

        let ratingSum = 0;
        const ratingCounters = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0
        };

        for (const review of data) {
            const rating = review.rating;
            ratingSum += rating;
            if (ratingCounters.hasOwnProperty(rating)) {
                ratingCounters[rating]++;
            }
        }

        const ratingAverage = parseFloat((ratingSum / reviewCount).toFixed(2));

        return {
            data,
            reviewCount,
            ratingAverage,
            countOneStartRating: ratingCounters[1],
            countTwoStartRating: ratingCounters[2],
            countThreeStartRating: ratingCounters[3],
            countFourStartRating: ratingCounters[4],
            countFiveStartRating: ratingCounters[5]
        };
    }

    async findSingleProduct(slug: string) {
        try {
            const product = await this.productRepository.findBySlug(slug);

            if (!product) {
                throw new HttpException('Product not found!', HttpStatus.BAD_REQUEST);
            }

            const [productImages, relatedProductsRaw, productReview, vendor, vendorProfile, seoData, megaDiscount] = await Promise.all([
                this.productImageGalleryRepository.findAll({ productId: product.id }),
                this.productRepository.findByQueryWithHardLimit({ mainCategoryId: product.mainCategoryId, status: true }),
                this.getProductReviewData(product.id),
                this.userRepository.findOne(product.vendorId),
                this.userProfileRepository.findOneByQuery({ user: { id: product.vendorId } }),
                this.productSeoRepository.findOneByQuery({ productId: product.id }),
                this.megaDiscountRepository.getSingleton()
            ]);

            const relatedProducts = relatedProductsRaw.filter(p => p.id !== product.id).map((p) => toSafeProduct(p, megaDiscount));

            const metaKeys = ['createdAt', 'updatedAt', 'isDeleted'] as const;

            const payload = {
                ...toSafeProduct(product, megaDiscount),
                productImages: omitMany(productImages, [...metaKeys]),
                relatedProducts,
                productReview,
                vendor: vendor
                    ? {
                        ...toSafeUser(vendor),
                        profile: vendorProfile ? omit(vendorProfile, [...metaKeys]) : null
                    }
                    : null,
                seoData: seoData ? omit(seoData, [...metaKeys]) : {}
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async getCommonData() {
        try {
            const firstCategoryOrder: FindOptionsOrder<FirstCategory> = {
                position: 'asc',
                createdAt: 'desc'
            };

            const [
                mainCategories,
                allFirstCategories,
                allSecondCategories,
                faqData,
                headerFooterData,
                socialLinkData,
                metaData,
                megaDiscountRecord
            ] = await Promise.all([
                // Fix: limit categories to prevent huge data load and memory consumption
                this.mainCategoryRepository.getRepository().find({
                    where: { status: true, isDeleted: false },
                    order: { position: 'asc', createdAt: 'desc' } as any,
                    take: 50
                }),
                this.firstCategoryRepository.getRepository().find({
                    where: { status: true, isDeleted: false },
                    order: { position: 'asc', createdAt: 'desc' } as any,
                    take: 200
                }),
                this.secondCategoryRepository.getRepository().find({
                    where: { status: true, isDeleted: false },
                    order: { position: 'asc', createdAt: 'desc' } as any,
                    take: 500
                }),
                this.faqRepository.findAll(),
                this.headerFooterCmsRepository.findAll(),
                this.socialLinkRepository.findAll(),
                this.pageMetaRepository.findAll(),
                this.megaDiscountRepository.getSingleton()
            ]);

            const metaKeys = ['createdAt', 'updatedAt', 'isDeleted'] as const;

            const secondByFirstMap = new Map<string, any[]>();
            for (const sc of allSecondCategories) {
                const list = secondByFirstMap.get(sc.firstCategoryId) || [];
                list.push(omit(sc, [...metaKeys]));
                secondByFirstMap.set(sc.firstCategoryId, list);
            }

            const firstByMainMap = new Map<string, any[]>();
            for (const fc of allFirstCategories) {
                const secondCats = secondByFirstMap.get(fc.id) || [];
                const list = firstByMainMap.get(fc.mainCategoryId) || [];
                list.push({
                    ...omit(fc, [...metaKeys]),
                    secondCategories: secondCats
                });
                firstByMainMap.set(fc.mainCategoryId, list);
            }

            const nestedCategories = mainCategories.map((mc) => ({
                ...omit(mc, [...metaKeys]),
                firstCategories: firstByMainMap.get(mc.id) || []
            }));

            const data = {
                mainCategory: omitMany(mainCategories, [...metaKeys]),
                nestedCategories: nestedCategories,
                faqData: omitMany(faqData, [...metaKeys]),
                headerFooterData: headerFooterData.length ? omit(headerFooterData[0], [...metaKeys]) : {},
                socialLinkData: omitMany(socialLinkData, [...metaKeys]),
                metaData: omitMany(metaData, [...metaKeys]),
                megaDiscount: {
                    isActive: megaDiscountRecord.isActive,
                    discountPercentage: Number(megaDiscountRecord.discountPercentage || 0),
                    menuText: megaDiscountRecord.menuText || 'Mega Sale'
                }
            }

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async findAdminDashboardData() {
        try {
            const sort: FindOptionsOrder<Orders> = {
                createdAt: 'desc'
            };

            const order: FindOptionsOrder<Product> = {
                createdAt: 'desc'
            };

            const [
                totalProducts,
                totalOrders,
                totalVendors,
                totalCustomers,
                recentProducts,
                recentOrdersRaw
            ] = await Promise.all([
                this.productRepository.count(),
                this.ordersRepository.count(),
                this.userRepository.count({ role: Role.VENDOR }),
                this.userRepository.count({ role: Role.CUSTOMER }),
                this.productRepository.paginateWithHardLimit({
                    page: 1,
                    limit: 5,
                    maxTotal: 5,
                    order
                }),
                this.ordersRepository.paginateWithHardLimit({
                    page: 1,
                    limit: 5,
                    maxTotal: 5,
                    order: sort,
                    relations: ['orderSummaries', 'user']
                })
            ]);

            const recentOrders = (recentOrdersRaw.data ?? []).map(order => {
                const totalCommission = (order.orderSummaries || []).reduce(
                    (sum, item) => sum + Number(item.commissionAmount ?? 0),
                    0
                );

                return {
                    ...order,
                    totalCommission
                };
            });

            const payload = {
                totalProducts: totalProducts,
                totalOrders: totalOrders,
                totalVendors: totalVendors,
                totalCustomers: totalCustomers,
                recentProducts: recentProducts ?? [],
                recentOrders: recentOrders ?? []
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async findVendorDashboardData(userData: any) {
        try {
            const productQuery: ProductFilter = { vendorId: userData.id };

            const productOrder: FindOptionsOrder<Product> = {
                createdAt: 'desc'
            };

            const [totalProducts, recentProducts, totalMessages, totalReviews] = await Promise.all([
                this.productRepository.count(productQuery),
                this.productRepository.paginateWithHardLimit({
                    page: 1,
                    limit: 5,
                    maxTotal: 5,
                    query: productQuery,
                    order: productOrder
                }),
                this.vendorMessageRepository.count(productQuery),
                this.productReviewRepository.count(productQuery)
            ]);

            const allVendorSummaries = await this.orderSummaryRepository.findAll({
                vendorId: userData.id
            });

            const orderIds = [...new Set(allVendorSummaries.map(s => s.orderId))];

            const recentOrdersRaw = await this.ordersRepository.findByQueryWithHardLimit({
                id: In(orderIds),
                isDeleted: false
            }, 5, ['user']);

            const recentOrders = recentOrdersRaw.map(order => {
                const summaries = allVendorSummaries.filter(s => s.orderId === order.id);

                const vendorTotalAmount = summaries.reduce(
                    (sum, item) => sum + Number(item.price) * item.quantity,
                    0
                );

                const vendorTotalCommission = summaries.reduce(
                    (sum, item) => sum + Number(item.commissionAmount ?? 0),
                    0
                );

                return {
                    ...order,
                    orderSummaries: summaries,
                    user: order.user,
                    vendorTotalAmount,
                    vendorTotalCommission
                };
            });

            const payload = {
                totalProducts,
                recentProducts: recentProducts ?? [],
                totalOrders: orderIds.length,
                recentOrders,
                totalMessages,
                totalReviews
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async findVendorList(dto: UserFilterDto) {
        try {
            let query: UserFilter = {};

            if (dto.role) {
                query.role = dto.role;
            }

            const vendorList = await this.userRepository.findAll(query);
            const safeVendorList = (vendorList ?? []).map(toSafeUser);

            const data = {
                vendorList: safeVendorList ?? []
            }

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findAdminList(dto: UserFilterDto) {
        try {
            let query: UserFilter = {};

            if (dto.role) {
                query.role = dto.role;
            }

            const adminList = await this.userRepository.findAll(query);

            const safeAdminList = (adminList ?? []).map(toSafeUser);

            const data = {
                adminList: safeAdminList ?? []
            }

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findCustomerList(dto: UserFilterDto) {
        try {
            let query: UserFilter = {};

            if (dto.role) {
                query.role = dto.role;
            }

            const customerList = await this.userRepository.findAll(query);

            const safeCustomerList = (customerList ?? []).map(toSafeUser);

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', safeCustomerList ?? []);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}