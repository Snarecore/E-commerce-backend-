import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductSeo } from './entity/product-seo.entity';
import { ProductSeoRepository } from './product-seo.repository';
import { ProductSeoService } from './product-seo.service';
import { ProductSeoController } from './product-seo.controller';
import { ProductRepository } from 'src/module/inventory/product/product.repository';

@Module({
    imports: [TypeOrmModule.forFeature([ProductSeo])],
    providers: [ProductSeoRepository, ProductSeoService, ProductRepository],
    controllers: [ProductSeoController],
    exports: [ProductSeoService]
})
export class ProductSeoModule { }
