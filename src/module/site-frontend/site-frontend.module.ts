import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from "@nestjs/jwt";
import { JwtConfigService } from "src/configs/jwt.config";
import { SiteFrontendController } from "./site-frontend.controller";
import { SiteFrontendService } from "./site-frontend.service";
import { MainCategory } from '../inventory/main-category/entities/main-category.entity';
import { FirstCategory } from '../inventory/first-category/entities/first-category.entity';
import { MainCategoryRepository } from '../inventory/main-category/main-category.repository';
import { FirstCategoryRepository } from '../inventory/first-category/first-category.repository';
import { SecondCategory } from '../inventory/second-category/entities/second-category.entity';
import { SecondCategoryRepository } from '../inventory/second-category/second-category.repository';
import { HeroSliderRepository } from '../setting/hero-slider/hero-slider.repository';
import { PromotionsRepository } from '../setting/promotions/promotions.repository';
import { HeroSlider } from '../setting/hero-slider/entities/hero-slider.entity';
import { Promotions } from '../setting/promotions/entities/promotions.entity';
import { ProductRepository } from '../inventory/product/product.repository';
import { ProductImageGalleryRepository } from '../inventory/product-image-gallery/product-image-gallery.repository';
import { Product } from '../inventory/product/entities/product.entity';
import { ProductImageGallery } from '../inventory/product-image-gallery/entities/product-image-gallery.entity';
import { FaqRepository } from '../setting/faq/faq.repository';
import { Faq } from '../setting/faq/entities/faq.entity';
import { ShopPageCmsRepository } from '../setting/shop/shop-page-cms/shop-page-cms.repository';
import { ShopPageCms } from '../setting/shop/shop-page-cms/entities/shop-page-cms.entity';
import { HomePageCmsRepository } from '../setting/home/home-page-cms/home-page-cms.repository';
import { HomePageCms } from '../setting/home/home-page-cms/entities/home-page-cms.entity';
import { HeaderFooterCmsRepository } from '../setting/header-footer-cms/header-footer-cms.repository';
import { OrdersRepository } from '../order/order.repository';
import { UserRepository } from '../user/user.repository';
import { SocialLinkRepository } from '../setting/social-link/social-link.repository';
import { ProductReviewRepository } from '../inventory/product-review/product-review.repository';
import { OrderSummaryRepository } from '../order-summary/order-summary.repository';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { PageMetaRepository } from '../seo/page-meta/page-meta.repository';
import { VendorMessageRepository } from '../setting/vendor-message/vendor-message.repository';
import { ProductSeoRepository } from '../seo/product-meta/product-seo.repository';

@Module({
    imports: [
        JwtModule.registerAsync({
            useClass: JwtConfigService
        }),
        TypeOrmModule.forFeature([
            MainCategory, 
            FirstCategory, 
            SecondCategory,
            HeroSlider,
            Promotions,
            Product,
            ProductImageGallery,
            Faq,
            ShopPageCms,
            HomePageCms
        ])
    ],
    controllers: [SiteFrontendController],
    providers: [
        SiteFrontendService,
        MainCategoryRepository,
        FirstCategoryRepository,
        SecondCategoryRepository,
        HeroSliderRepository,
        PromotionsRepository,
        ProductRepository,
        ProductImageGalleryRepository,
        FaqRepository,
        ShopPageCmsRepository,
        HomePageCmsRepository,
        HeaderFooterCmsRepository,
        OrdersRepository,
        UserRepository,
        SocialLinkRepository,
        ProductReviewRepository,
        OrderSummaryRepository,
        UserProfileRepository,
        PageMetaRepository,
        VendorMessageRepository,
        ProductSeoRepository
    ]
})
export class SiteFrontendModule {}