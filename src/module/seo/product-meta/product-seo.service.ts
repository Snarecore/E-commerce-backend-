import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrUpdateProductSeoDto } from './dto/product-seo.dto';
import { ProductSeoRepository } from './product-seo.repository';
import { ProductSeo } from './entity/product-seo.entity';
import { ProductRepository } from 'src/module/inventory/product/product.repository';
import { ProductMetaFilterDto } from './dto/product-meta-filter.dto';
import { ApiResponse, ResponseUtils } from 'src/utils/response.utils';
import { FindOptionsOrder } from 'typeorm';

@Injectable()
export class ProductSeoService {
    constructor(
        private readonly seoRepository: ProductSeoRepository,
        private readonly productRepository: ProductRepository
    ) { }

    async upsertProductSeo(dto: CreateOrUpdateProductSeoDto) {
        const existing = await this.seoRepository.findOneByQuery({ productId: dto.productId });

        if (existing) {
            const result = await this.seoRepository.update(existing.id, {
                metaTitle: dto.metaTitle,
                metaDescription: dto.metaDescription,
                metaKeywords: dto.metaKeywords
            });

            return ResponseUtils.successResponseHandler(200, 'Data updated successfully.', 'data', result);
        }

        const output = await this.seoRepository.create(dto);
        return ResponseUtils.successResponseHandler(200, 'Data created successfully.', 'data', output);
    }

    async getSeoByProduct(productId: string): Promise<ProductSeo> {
        const seo = await this.seoRepository.findOneByQuery({ productId });
        if (!seo) throw new NotFoundException('SEO data not found for product');
        return seo;
    }

    async syncProductSeoData(): Promise<void> {
        const allProducts = await this.productRepository.findAll();

        for (const product of allProducts) {
            const existingSeo = await this.seoRepository.findOneByQuery({ productId: product.id });

            if (!existingSeo) {
                await this.seoRepository.create({
                    productId: product.id,
                    productName: product.name,
                    productImage: product.featuredImage,
                    metaTitle: product.name,
                    metaDescription: product.summary || '',
                    metaKeywords: ''
                });
            }
        }

        console.log('Product seo synchronization completed.');
    }

    async findAll(dto: ProductMetaFilterDto): Promise<ApiResponse<{ data: any[]; total: number; page: number; limit: number, pageCount: number }>> {
        try {
            let query = {};

            const order: FindOptionsOrder<ProductSeo> = {
                createdAt: 'desc'
            };

            const result = await this.seoRepository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order
            });

            const payload = {
                data: result?.data,
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
