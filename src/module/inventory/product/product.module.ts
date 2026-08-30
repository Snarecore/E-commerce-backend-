import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../space-module/space-service';
import { ProductController } from './product.controller';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';
import { Product } from './entities/product.entity';
import { ProductImageGallery } from '../product-image-gallery/entities/product-image-gallery.entity';
import { ProductImageGalleryRepository } from '../product-image-gallery/product-image-gallery.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Product, ProductImageGallery])
	],
	controllers: [ProductController],
	providers: [ProductService, ProductRepository, SpaceService, R2ServiceProvider, ProductImageGalleryRepository],
	exports: [ProductService, ProductRepository]
})

export class ProductModule {}
