import { HttpException, HttpStatus, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ResponseUtils } from 'src/utils/response.utils';
import { MainCategoryRepository } from "../inventory/main-category/main-category.repository";
import { FirstCategoryRepository } from "../inventory/first-category/first-category.repository";
import { SecondCategoryRepository } from "../inventory/second-category/second-category.repository";
import { ThirdCategoryRepository } from "../inventory/third-category/third-category.repository";
import { HeroSliderRepository } from "../setting/hero-slider/hero-slider.repository";
import { PromotionsRepository } from "../setting/promotions/promotions.repository";
import { ProductRepository } from "../inventory/product/product.repository";
import { FindOptionsOrder, In } from 'typeorm';
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
import { Role } from "src/enums/role.enum";
import { Orders } from "../order/entity/order.entity";
import { SocialLinkRepository } from "../setting/social-link/social-link.repository";
import { HeroSlider } from "../setting/hero-slider/entities/hero-slider.entity";
import { Promotions } from "../setting/promotions/entities/promotions.entity";
import { UserFilterDto } from "../user/dto/user-filter.dto";
import { UserFilter } from "../user/type/user-filter.type";
import { ProductReviewRepository } from "../inventory/product-review/product-review.repository";
import { OrderSummaryRepository } from "../order-summary/order-summary.repository";
import { UserProfileRepository } from "../user-profile/user-profile.repository";
import { BlogFilterDto } from "../blog/dto/blog-filter.dto";
import { Blog } from "../blog/entities/blog.entity";
import { BlogRepository } from "../blog/blog.repository";
import { toSafeUser } from "src/utils/safe-user.utils";
import { PageMetaRepository } from "../seo/page-meta/page-meta.repository";
import { VendorMessageRepository } from "../setting/vendor-message/vendor-message.repository";
import { toSafeProduct } from "src/utils/safe-product.util";
import { ProductSeoRepository } from "../seo/product-meta/product-seo.repository";
import { omit, omitMany } from "src/utils/helper.utils";

@Injectable()
export class SiteFrontendService {
    constructor(
        private readonly mainCategoryRepository: MainCategoryRepository,
        private readonly firstCategoryRepository: FirstCategoryRepository,
        private readonly secondCategoryRepository: SecondCategoryRepository,
        private readonly thirdCategoryRepository: ThirdCategoryRepository,
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
        private readonly blogRepository: BlogRepository,
        private readonly pageMetaRepository: PageMetaRepository,
        private readonly vendorMessageRepository: VendorMessageRepository,
        private readonly productSeoRepository: ProductSeoRepository
    ) { }

    async getMainCategoryData() {
        try {
            const mainCategory = await this.mainCategoryRepository.findAll({ status: true });

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
            const firstCategories = await this.firstCategoryRepository.findAll({
                status: true,
                mainCategoryId: mainCategoryId
            });

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
            const secondCategories = await this.secondCategoryRepository.findAll({
                status: true,
                firstCategoryId: firstCategoryId
            });

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

    async getThirdCategoryBySecondCategoryId(secondCategoryId: string) {
        try {
            const thirdCategories = await this.thirdCategoryRepository.findAll({
                status: true,
                secondCategoryId: secondCategoryId
            });

            const data = {
                thirdCategories: thirdCategories ?? []
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

            const [
                contentData,
                heroSlider,
                promotions,
                sectionOneProducts,
                sectionTwoProducts,
                sectionThreeProducts,
                sectionFourProducts,
                sectionFiveProducts,
                sectionSixProducts
            ] = await Promise.all([
                this.homePageCmsRepository.findAll(),
                this.heroSliderRepository.findAllWithOrder({ status: true }, order),
                this.promotionsRepository.findAllWithOrder({ status: true }, sort),
                this.productRepository.findAll({ isProductSectionOne: true, status: true, isApprove: true }),
                this.productRepository.findAll({ isProductSectionTwo: true, status: true, isApprove: true }),
                this.productRepository.findAll({ isProductSectionThree: true, status: true, isApprove: true }),
                this.productRepository.findAll({ isProductSectionFour: true, status: true, isApprove: true }),
                this.productRepository.findAll({ isProductSectionFive: true, status: true, isApprove: true }),
                this.productRepository.findAll({ isProductSectionSix: true, status: true, isApprove: true })
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

            const data = {
                contentData: filteredContentData,
                heroSlider: filteredHeroSlider,
                promotions: filteredPromotions,
                sectionOneProducts: sectionOneProducts.map(toSafeProduct) ?? [],
                sectionTwoProducts: sectionTwoProducts.map(toSafeProduct) ?? [],
                sectionThreeProducts: sectionThreeProducts.map(toSafeProduct) ?? [],
                sectionFourProducts: sectionFourProducts.map(toSafeProduct) ?? [],
                sectionFiveProducts: sectionFiveProducts.map(toSafeProduct) ?? [],
                sectionSixProducts: sectionSixProducts.map(toSafeProduct) ?? []
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
            const [recommendedProductsRaw] = await Promise.all([
                this.productRepository.findAll({
                    isProductSectionTwo: true,
                    status: true,
                    isApprove: true
                })
            ]);

            const recommendedProducts = recommendedProductsRaw.map(toSafeProduct);

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
            let query: ProductFilter = {};

            if (dto.mainCategoryId) {
                query.mainCategoryId = dto.mainCategoryId;
            }

            if (dto.firstCategoryId) {
                query.firstCategoryId = dto.firstCategoryId;
            }

            if (dto.secondCategoryId) {
                query.secondCategoryId = dto.secondCategoryId;
            }

            if (dto.thirdCategoryId) {
                query.thirdCategoryId = dto.thirdCategoryId;
            }

            if (dto.searchKeyword) {
                query.name = ILike(`%${dto.searchKeyword}%`);
            }

            query.status = true;
            query.isApprove = true;

            const order: FindOptionsOrder<Product> = {
                createdAt: 'desc'
            };

            const result = await this.productRepository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order
            });

            const safeData = result.data.map(toSafeProduct);

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

    async findProductListWithHardLimit(dto: ProductFilterDto) {
        try {
            let query: ProductFilter = {};

            query.status = true;
            query.isApprove = true;

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

            const safeData = result.data.map(toSafeProduct);

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

            const [productImages, relatedProductsRaw, productReview, vendor, vendorProfile, seoData] = await Promise.all([
                this.productImageGalleryRepository.findAll({ productId: product.id }),
                this.productRepository.findByQueryWithHardLimit({ mainCategoryId: product.mainCategoryId, isApprove: true }),
                this.getProductReviewData(product.id),
                this.userRepository.findOne(product.vendorId),
                this.userProfileRepository.findOneByQuery({ user: { id: product.vendorId } }),
                this.productSeoRepository.findOneByQuery({ productId: product.id })
            ]);

            const relatedProducts = relatedProductsRaw.filter(p => p.id !== product.id).map(toSafeProduct);

            const metaKeys = ['createdAt', 'updatedAt', 'isDeleted'] as const;

            const payload = {
                ...toSafeProduct(product),
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
            const mainCategories = await this.mainCategoryRepository.findAll({ status: true });
            const faqData = await this.faqRepository.findAll();
            const headerFooterData = await this.headerFooterCmsRepository.findAll();
            const socialLinkData = await this.socialLinkRepository.findAll();
            const metaData = await this.pageMetaRepository.findAll();

            const metaKeys = ['createdAt', 'updatedAt', 'isDeleted'] as const;

            const nestedCategories = await Promise.all(
                mainCategories.map(async (mainCategory) => {
                    const firstCategories = await this.firstCategoryRepository.findAll({
                        status: true,
                        mainCategoryId: mainCategory.id
                    });

                    const firstCategoryData = await Promise.all(
                        firstCategories.map(async (firstCategory) => {
                            const secondCategories = await this.secondCategoryRepository.findAll({
                                status: true,
                                firstCategoryId: firstCategory.id
                            });

                            const secondCategoryData = await Promise.all(
                                secondCategories.map(async (secondCategory) => {
                                    const thirdCategories = await this.thirdCategoryRepository.findAll({
                                        status: true,
                                        secondCategoryId: secondCategory.id
                                    });

                                    return {
                                        ...omit(secondCategory, [...metaKeys]),
                                        thirdCategories
                                    };
                                })
                            );

                            return {
                                ...omit(firstCategory, [...metaKeys]),
                                secondCategories: secondCategoryData
                            };
                        })
                    );

                    return {
                        ...omit(mainCategory, [...metaKeys]),
                        firstCategories: firstCategoryData
                    };
                })
            );

            const data = {
                mainCategory: omitMany(mainCategories, [...metaKeys]),
                nestedCategories: nestedCategories,
                faqData: omitMany(faqData, [...metaKeys]),
                headerFooterData: headerFooterData.length ? omit(headerFooterData[0], [...metaKeys]) : {},
                socialLinkData: omitMany(socialLinkData, [...metaKeys]),
                metaData: omitMany(metaData, [...metaKeys])
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
                const totalCommission = order.orderSummaries.reduce(
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

            const data = {
                vendorList: vendorList ?? []
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

            const data = {
                customerList: safeCustomerList ?? []
            }

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findBlogList(dto: BlogFilterDto) {
        try {
            let query: any = {};

            query.status = true;

            const order: FindOptionsOrder<Blog> = {
                createdAt: 'desc'
            };

            const result = await this.blogRepository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order
            });

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', result);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }

    async findSingleBlog(slug: string) {
        try {
            const blog = await this.blogRepository.findBySlug(slug);

            if (!blog) {
                throw new HttpException('Blog not found!', HttpStatus.BAD_REQUEST);
            }

            let query: any = {};

            query.status = true;

            const order: FindOptionsOrder<Blog> = {
                createdAt: 'desc'
            };

            const latestBlogList = await this.blogRepository.findByQueryWithHardLimit(query, 10, [], order);

            const latestBlogListFiltered = (latestBlogList ?? []).filter(b => b.slug !== blog.slug);

            const metaKeys = ['createdAt', 'updatedAt', 'isDeleted'] as const;

            const safeBlog = omit(blog, [...metaKeys]);
            const safeLatestBlogList = omitMany(latestBlogListFiltered, [...metaKeys]);

            const payload = {
                ...safeBlog,
                latestBlogList: safeLatestBlogList
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error) {
            throw new InternalServerErrorException(
                error.message || 'An unexpected error occurred while fetching data.'
            );
        }
    }
}