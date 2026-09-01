import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getTypeOrmConfig } from './configs/typeorm.config';
import { AuthModule } from './module/auth/auth.module';
import { CoreModule } from './module/core/core.module';
import { RolesModule } from './module/roles/roles.module';
import { UserModule } from './module/user/user.module';
import { HeroSliderModule } from './module/setting/hero-slider/hero-slider.module';
import { SpaceModule } from './module/space-module/space.module';
import { PromotionsModule } from './module/setting/promotions/promotions.module';
import { PopupModule } from './module/setting/popup/popup.module';
import { MainCategoryModule } from './module/inventory/main-category/main-category.module';
import { FirstCategoryModule } from './module/inventory/first-category/first-category.module';
import { SecondCategoryModule } from './module/inventory/second-category/second-category.module';
import { SiteFrontendModule } from './module/site-frontend/site-frontend.module';
import { ProductModule } from './module/inventory/product/product.module';
import { ProductReviewModule } from './module/inventory/product-review/product-review.module';
import { ProductImageGalleryModule } from './module/inventory/product-image-gallery/product-image-gallery.module';
import { UniqueCodeGeneratorModule } from './module/unique-code-generator/unique-code-generator.module';
import { FaqModule } from './module/setting/faq/faq.module';
import { HomePageCmsModule } from './module/setting/home/home-page-cms/home-page-cms.module';
import { ShopPageCmsModule } from './module/setting/shop/shop-page-cms/shop-page-cms.module';
import { ContactUsMessageModule } from './module/setting/contact-us/contact-us-message/contact-us-message.module';
import { ContactPageCmsModule } from './module/setting/contact-us/contact-page-cms/contact-page-cms.module';
import { RolesGuard } from './guards/role.guard';
import { JwtAuthModule } from './module/core/jwt/jwt-auth.module';
import { HeaderFooterCmsModule } from './module/setting/header-footer-cms/header-footer-cms.module';
import { PaymentsModule } from './module/payments/payments.module';
import { OrdersModule } from './module/order/order.module';
import { OrderSummaryModule } from './module/order-summary/order-summary.module';
import { UserProfileModule } from './module/user-profile/user-profile.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SocialLinkModule } from './module/setting/social-link/social-link.module';
import { VendorMessageModule } from './module/setting/vendor-message/vendor-message.module';
import { NotificationModule } from './module/notification/notification.module';
import { MessageModule } from './module/chat/message/message.module';
import { ConversationModule } from './module/chat/conversation/conversation.module';
import { PageMetaModule } from './module/seo/page-meta/page-meta.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ProductSeoModule } from './module/seo/product-meta/product-seo.module';
import { PolicyOneCmsModule } from './module/setting/policy/policy-one-cms/policy-one-cms.module';
import { PolicyTwoCmsModule } from './module/setting/policy/policy-two-cms/policy-two-cms.module';
import { PolicyThreeCmsModule } from './module/setting/policy/policy-three-cms/policy-three-cms.module';
import { PolicyFourCmsModule } from './module/setting/policy/policy-four-cms/policy-four-cms.module';
import { PolicyFiveCmsModule } from './module/setting/policy/policy-five-cms/policy-five-cms.module';
import { PolicySixCmsModule } from './module/setting/policy/policy-six-cms/policy-six-cms.module';
import { PolicySevenCmsModule } from './module/setting/policy/policy-seven-cms/policy-seven-cms.module';
import { PolicyEightCmsModule } from './module/setting/policy/policy-eight-cms/policy-eight-cms.module';
import { PolicyNineCmsModule } from './module/setting/policy/policy-nine-cms/policy-nine-cms.module';
import { PolicyTenCmsModule } from './module/setting/policy/policy-ten-cms/policy-ten-cms.module';
import { PolicyElevenCmsModule } from './module/setting/policy/policy-eleven-cms/policy-eleven-cms.module';
import { PolicyTwelveCmsModule } from './module/setting/policy/policy-twelve-cms/policy-twelve-cms.module';
import { ProductCommentModule } from './module/inventory/product-comment/product-comment.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { EmailServiceModule } from './module/email-service/email-sender.module';
import { SesModule } from './common/ses/ses.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './guards/custom-throttler.guard';

import { CouponModule } from './module/coupon/coupon.module';
import { MegaDiscountModule } from './module/setting/mega-discount/mega-discount.module';
import { AuditLogModule } from './module/audit-log/audit-log.module';
import { AppController } from './app.controller';

@Module({
	controllers: [AppController],
	imports: [
		ThrottlerModule.forRoot({
			throttlers: [
				{
					ttl: 60000,
					limit: 100,
				},
			],
		}),
		ConfigModule.forRoot({
			isGlobal: true
		}),
		MailerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => {
				const port = parseInt(config.get<string>('EMAIL_PORT') ?? '465', 10);
				const secure = (config.get<string>('EMAIL_SECURE') ?? '').toLowerCase() === 'true' || port === 465;

				return {
					transport: {
						host: config.get<string>('EMAIL_HOST'),
						port,
						secure,
						auth: {
							user: config.get<string>('EMAIL_USER'),
							pass: config.get<string>('EMAIL_PASS')
						}
					},
					defaults: {
						from: `"${config.get<string>('EMAIL_SENDER_NAME')}" <${config.get<string>('EMAIL_SENDER_MAIL')}>`
					},
					template: {
						dir: join(process.cwd(), 'templates'),
						adapter: new HandlebarsAdapter(),
						options: { strict: true }
					}
				};
			}
		}),
		TypeOrmModule.forRoot(getTypeOrmConfig()),
		ScheduleModule.forRoot(),
		JwtAuthModule,
		SpaceModule,
		AuthModule,
		UserModule,
		CoreModule,
		RolesModule,
		HeroSliderModule,
		PromotionsModule,
		MainCategoryModule,
		FirstCategoryModule,
		SecondCategoryModule,
		SiteFrontendModule,
		ProductModule,
		ProductReviewModule,
		ProductImageGalleryModule,
		UniqueCodeGeneratorModule,
		FaqModule,
		ContactUsMessageModule,
		HomePageCmsModule,
		ShopPageCmsModule,
		ContactPageCmsModule,
		UserProfileModule,
		HeaderFooterCmsModule,
		PaymentsModule,
		OrdersModule,
		OrderSummaryModule,
		SocialLinkModule,
		VendorMessageModule,
		NotificationModule,
		MessageModule,
		ConversationModule,
		PageMetaModule,
		ProductSeoModule,
		PolicyOneCmsModule,
		PolicyTwoCmsModule,
		PolicyThreeCmsModule,
		PolicyFourCmsModule,
		PolicyFiveCmsModule,
		PolicySixCmsModule,
		PolicySevenCmsModule,
		PolicyEightCmsModule,
		PolicyNineCmsModule,
		PolicyTenCmsModule,
		PolicyElevenCmsModule,
		PolicyTwelveCmsModule,
		ProductCommentModule,
		EmailServiceModule,
		SesModule,
		CouponModule,
		MegaDiscountModule,
		AuditLogModule,
		PopupModule
	],
	providers: [
		{
			provide: APP_GUARD,
			useClass: CustomThrottlerGuard
		},
		{
			provide: APP_GUARD,
			useClass: JwtAuthGuard
		},
		{
			provide: APP_GUARD,
			useFactory: (reflector) => new RolesGuard(reflector),
			inject: [Reflector]
		}
	]
})

export class AppModule {
	constructor(private dataSource: DataSource) { }
}
