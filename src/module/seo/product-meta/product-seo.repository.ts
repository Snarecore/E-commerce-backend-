import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AbstractRepository } from 'src/database/abstract.repository';
import { ProductSeo } from './entity/product-seo.entity';

@Injectable()
export class ProductSeoRepository extends AbstractRepository<ProductSeo> {
    constructor(dataSource: DataSource) {
        super(dataSource, ProductSeo);
    }
}
