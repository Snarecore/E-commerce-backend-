import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { ProductImageGallery } from './entities/product-image-gallery.entity';

@Injectable()
export class ProductImageGalleryRepository extends AbstractRepository<ProductImageGallery> {
	constructor(dataSource: DataSource) {
		super(dataSource, ProductImageGallery);
	}
}
