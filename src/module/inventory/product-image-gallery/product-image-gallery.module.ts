import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductImageGallery } from './entities/product-image-gallery.entity';
import { ProductImageGalleryRepository } from './product-image-gallery.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ProductImageGallery])
	],
	controllers: [],
	providers: [ProductImageGalleryRepository],
	exports: [ProductImageGalleryRepository]
})

export class ProductImageGalleryModule {}
