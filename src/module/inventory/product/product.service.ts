import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UploadMulterFile } from '../../space-module/space-service';
import { SpaceService } from '../../space-module/space-service/space.service';
import { ResponseUtils, ApiResponse } from '../../../utils/response.utils';
import { ProductRepository } from './product.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductInterface } from './type/product.type';
import { Product } from './entities/product.entity';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductImageGalleryRepository } from '../product-image-gallery/product-image-gallery.repository';
import { Between, FindOptionsOrder, ILike, In, LessThanOrEqual, MoreThan, MoreThanOrEqual } from 'typeorm';
import { ProductFilter } from './type/product-filter.type';
import { ProductFilterDto } from './dto/product-filter.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { Optional } from '@nestjs/common';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '../../audit-log/constants/audit-action.enum';
import { AuditModule } from '../../audit-log/constants/audit-module.enum';
import { AuditTargetType } from '../../audit-log/constants/audit-target-type.enum';

@Injectable()
export class ProductService {
    constructor(
        private readonly spaceService: SpaceService,
        private readonly repository: ProductRepository,
        private readonly productImageGalleryRepository: ProductImageGalleryRepository,
        @Optional() private readonly auditLogService?: AuditLogService
    ) {}

    async create(
        dto: CreateProductDto,
        files: {
            featuredImage?: UploadMulterFile;
            productImages?: UploadMulterFile[];
            fileUrl?: UploadMulterFile;
        },
        userData: any
    ): Promise<ApiResponse<ProductInterface>> {
        try {
            const slug = this.generateSlug(dto.name);
            const existingProduct = await this.repository.findBySlug(slug);
            if (existingProduct) {
                throw new HttpException('Product already exists.', HttpStatus.BAD_REQUEST);
            }

            if (userData) {
                dto.vendorId = userData?.id;
                dto.vendorName = userData?.name;
            }

            if (dto.sizeStock && typeof dto.sizeStock === 'object') {
                const totalQty = Object.values(dto.sizeStock).reduce((sum, q) => sum + (Number(q) || 0), 0);
                dto.quantity = totalQty;
                if (!dto.sizesString) {
                    dto.sizesString = Object.keys(dto.sizeStock).join(',');
                }
            }

            let featuredImagePromise: Promise<string | undefined> = Promise.resolve(undefined);
            if (files?.featuredImage?.[0]) {
                featuredImagePromise = this.spaceService.uploadFile(files.featuredImage[0], 'product');
            }

            let fileUrlPromise: Promise<string | undefined> = Promise.resolve(undefined);
            if (files?.fileUrl?.[0]) {
                fileUrlPromise = this.spaceService.uploadFile(files.fileUrl[0], 'product');
            }

            const [uploadedFeaturedImage, uploadedFileUrl] = await Promise.all([
                featuredImagePromise,
                fileUrlPromise
            ]);

            if (uploadedFeaturedImage) dto.featuredImage = uploadedFeaturedImage;
            if (uploadedFileUrl) dto.fileUrl = uploadedFileUrl;

            const output = (await this.repository.create({ ...dto, slug, isApprove: true, status: true })) as Product | null;
            if (!output) {
                throw new HttpException(
                    'Something went wrong! Please try again.',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }

            if (files?.productImages?.length) {
                const uploadedImages = await Promise.all(
                    files.productImages.map((image) => this.spaceService.uploadFile(image, 'product'))
                );

                const galleryRecords = uploadedImages
                    .filter((url): url is string => Boolean(url))
                    .map((url) => ({
                        productId: output.id,
                        imageUrl: url
                    }));

                if (galleryRecords.length > 0) {
                    await Promise.all(
                        galleryRecords.map((record) => this.productImageGalleryRepository.create(record))
                    );
                }
            }

            if (this.auditLogService && output) {
                this.auditLogService.createAsyncLog({
                    actorId: userData?.id || null,
                    actorName: userData?.name || null,
                    actorEmail: userData?.email || null,
                    actorRole: userData?.role || 'admin',
                    action: AuditAction.PRODUCT_CREATED,
                    module: AuditModule.PRODUCT,
                    targetId: output.id,
                    targetType: AuditTargetType.PRODUCT,
                    status: 'SUCCESS',
                    changes: {
                        type: 'SNAPSHOT',
                        before: null,
                        after: {
                            name: output.name,
                            price: output.price,
                            quantity: output.quantity,
                            sku: output.sku
                        }
                    }
                });
            }

            return ResponseUtils.successResponseHandler(201, 'Data saved successfully.', 'data', output);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findAll(
        dto: ProductFilterDto
    ): Promise<ApiResponse<{ data: ProductInterface[]; total: number; page: number; limit: number; pageCount: number; }>> {
        try {
            const page = dto.page ? Number(dto.page) : 1;
            const limit = dto.limit ? Number(dto.limit) : 10;
            const skip = (page - 1) * limit;

            const qb = this.repository.createQueryBuilder('product')
                .where('product.isDeleted = false')
                .andWhere('product.status = true')
                .andWhere('product.isApprove = true');

            if (dto.searchKeyword) {
                qb.andWhere('product.name LIKE :searchKeyword', { searchKeyword: `%${dto.searchKeyword}%` });
            }

            if (dto.mainCategoryId) {
                qb.andWhere('product.mainCategoryId = :mainCategoryId', { mainCategoryId: dto.mainCategoryId });
            }

            if (dto.firstCategoryId) {
                qb.andWhere('product.firstCategoryId = :firstCategoryId', { firstCategoryId: dto.firstCategoryId });
            }

            if (dto.secondCategoryId) {
                qb.andWhere('product.secondCategoryId = :secondCategoryId', { secondCategoryId: dto.secondCategoryId });
            }

            if (dto.vendorId) {
                qb.andWhere('product.vendorId = :vendorId', { vendorId: dto.vendorId });
            }

            if (dto.inStockOnly) {
                qb.andWhere('product.quantity > 0');
            }

            if (dto.discountOnly) {
                qb.andWhere('product.discountAmount > 0');
            }

            const effectivePriceSql = `(
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

            const result = {
                data: products,
                total,
                page,
                limit,
                pageCount
            };

            const productIds = (result?.data ?? []).map((p) => p.id);
            const allImages = productIds.length > 0
                ? await this.productImageGalleryRepository.findAll({ productId: In(productIds) })
                : [];

            const imagesByProductMap = new Map<string, any[]>();
            for (const img of allImages) {
                const list = imagesByProductMap.get(img.productId) || [];
                list.push(img);
                imagesByProductMap.set(img.productId, list);
            }

            const enrichedData = (result?.data ?? []).map((product) => ({
                ...product,
                productImages: imagesByProductMap.get(product.id) || []
            }));

            const payload = {
                data: enrichedData,
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount,
            };

            return ResponseUtils.successResponseHandler(
                200,
                'Data retrieved successfully.',
                'data',
                payload
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findAllForAdmin(
        dto: ProductFilterDto
    ): Promise<ApiResponse<{ data: ProductInterface[]; total: number; page: number; limit: number; pageCount: number; }>> {
        try {
            let query: ProductFilter = {};
            if (dto.searchKeyword) {
                query.name = ILike(`%${dto.searchKeyword}%`);
            }

            if (dto.sku) {
                query.sku = ILike(`%${dto.sku}%`);
            }

            if (typeof dto.isActive === 'boolean') {
                query.status = dto.isActive;
            }

            if (typeof dto.isApprove === 'boolean') {
                query.isApprove = dto.isApprove;
            }

            if (dto.startDate && dto.endDate) {
                query.createdAt = Between(
                    new Date(`${dto.startDate.toISOString().split('T')[0]}T00:00:00.000Z`),
                    new Date(`${dto.endDate.toISOString().split('T')[0]}T23:59:59.999Z`)
                );
            } else if (dto.startDate) {
                query.createdAt = MoreThanOrEqual(
                    new Date(`${dto.startDate.toISOString().split('T')[0]}T00:00:00.000Z`)
                );
            } else if (dto.endDate) {
                query.createdAt = LessThanOrEqual(
                    new Date(`${dto.endDate.toISOString().split('T')[0]}T23:59:59.999Z`)
                );
            }

            if (dto.mainCategoryId) {
                query.mainCategoryId = dto.mainCategoryId;
            }

            if (dto.firstCategoryId) {
                query.firstCategoryId = dto.firstCategoryId;
            }

            if (dto.secondCategoryId) {
                query.secondCategoryId = dto.secondCategoryId;
            }

            if (dto.vendorId) {
                query.vendorId = dto.vendorId;
            }

            const order: FindOptionsOrder<Product> = {
                createdAt: 'desc'
            };

            const result = await this.repository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order
            });

            const enrichedData = await Promise.all(
                result?.data?.map(async (product) => {
                    const productImages = await this.productImageGalleryRepository.findAll({
                        productId: product.id
                    });
                    return {
                        ...product,
                        productImages
                    };
                })
            );

            const payload = {
                data: enrichedData,
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

     async findAllForVendor(
        dto: ProductFilterDto,
        userData: any
    ): Promise<ApiResponse<{ data: ProductInterface[]; total: number; page: number; limit: number; pageCount: number; }>> {
        try {
            let query: ProductFilter = {};

            if (userData) {
                query.vendorId = userData?.id;
            }

            if (dto.searchKeyword) {
                query.name = ILike(`%${dto.searchKeyword}%`);
            }

            if (dto.sku) {
                query.sku = ILike(`%${dto.sku}%`);
            }

            if (typeof dto.isActive === 'boolean') {
                query.status = dto.isActive;
            }

            if (typeof dto.isApprove === 'boolean') {
                query.isApprove = dto.isApprove;
            }

            if (dto.startDate && dto.endDate) {
                query.createdAt = Between(
                    new Date(`${dto.startDate.toISOString().split('T')[0]}T00:00:00.000Z`),
                    new Date(`${dto.endDate.toISOString().split('T')[0]}T23:59:59.999Z`)
                );
            } else if (dto.startDate) {
                query.createdAt = MoreThanOrEqual(
                    new Date(`${dto.startDate.toISOString().split('T')[0]}T00:00:00.000Z`)
                );
            } else if (dto.endDate) {
                query.createdAt = LessThanOrEqual(
                    new Date(`${dto.endDate.toISOString().split('T')[0]}T23:59:59.999Z`)
                );
            }

            if (dto.mainCategoryId) {
                query.mainCategoryId = dto.mainCategoryId;
            }

            if (dto.firstCategoryId) {
                query.firstCategoryId = dto.firstCategoryId;
            }

            if (dto.secondCategoryId) {
                query.secondCategoryId = dto.secondCategoryId;
            }

            if (dto.vendorId) {
                query.vendorId = dto.vendorId;
            }

            const order: FindOptionsOrder<Product> = {
                createdAt: 'desc'
            };

            const result = await this.repository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order
            });

            const enrichedData = await Promise.all(
                result?.data?.map(async (product) => {
                    const productImages = await this.productImageGalleryRepository.findAll({
                        productId: product.id
                    });
                    return {
                        ...product,
                        productImages
                    };
                })
            );

            const payload = {
                data: enrichedData,
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

    async findOne(id: string): Promise<ApiResponse<ProductInterface>> {
        try {
            let data = await this.repository.findOne(id);
            if (!data) {
                throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
            }

            const productImages = await this.productImageGalleryRepository.findAll({
                productId: id,
            });

            const payload: ProductInterface = {
                ...data,
                productImages,
            };

            return ResponseUtils.successResponseHandler(
                200,
                'Data retrieved successfully.',
                'data',
                payload
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async update(
        id: string,
        dto: UpdateProductDto,
        files: {
            featuredImage?: UploadMulterFile;
            productImages?: UploadMulterFile[];
			fileUrl?: UploadMulterFile[];
        }
    ): Promise<ApiResponse<Product>> {
        try {
            const output = await this.repository.findOne(id);
            if (!output) {
                throw new HttpException('Data does not exist!', HttpStatus.BAD_REQUEST);
            }

            if (dto.name) {
                const slug = this.generateSlug(dto.name);
                const existingProduct = await this.repository.findBySlug(slug);
                if (existingProduct && existingProduct.id !== id) {
                    throw new HttpException('Product already exists.', HttpStatus.BAD_REQUEST);
                }
                dto.slug = slug;
            }

            if (dto.sizeStock && typeof dto.sizeStock === 'object') {
                const totalQty = Object.values(dto.sizeStock).reduce((sum, q) => sum + (Number(q) || 0), 0);
                dto.quantity = totalQty;
                if (!dto.sizesString) {
                    dto.sizesString = Object.keys(dto.sizeStock).join(',');
                }
            }

            let featuredImagePromise: Promise<string | undefined> = Promise.resolve(output.featuredImage);
            if (files?.featuredImage?.[0]) {
                featuredImagePromise = this.spaceService.uploadFile(files.featuredImage[0], 'product');
            }

            let fileUrlPromise: Promise<string | undefined> = Promise.resolve(output.fileUrl);
            if (files?.fileUrl?.[0]) {
                fileUrlPromise = this.spaceService.uploadFile(files.fileUrl[0], 'product');
            }

            let newProductImagesPromise: Promise<(string | undefined)[]> = Promise.resolve([]);
            if (files?.productImages?.length) {
                newProductImagesPromise = Promise.all(
                    files.productImages.map((file) => this.spaceService.uploadFile(file, 'product'))
                );
            }

            const [uploadedFeaturedImage, uploadedFileUrl, uploadedProductImages] = await Promise.all([
                featuredImagePromise,
                fileUrlPromise,
                newProductImagesPromise
            ]);

            dto.featuredImage = uploadedFeaturedImage || output.featuredImage;
            dto.fileUrl = uploadedFileUrl || output.fileUrl;

            const existingImages = dto.existingProductImages || [];
            const validNewProductImages = (uploadedProductImages || []).filter((url): url is string => Boolean(url));
            const finalProductImages = [...existingImages, ...validNewProductImages];

            await this.productImageGalleryRepository.deleteByQuery({ productId: id });
            await Promise.all(
                finalProductImages.map((imageUrl) =>
                    this.productImageGalleryRepository.create({
                        productId: id,
                        imageUrl
                    })
                )
            );

            const { existingProductImages, sizes, productImages, ...payload } = dto as any;
            if (!payload.vendorId || payload.vendorId === 'undefined' || payload.vendorId === 'null') {
                delete payload.vendorId;
            }
            if (!payload.vendorName || payload.vendorName === 'undefined' || payload.vendorName === 'null') {
                delete payload.vendorName;
            }
            const response = await this.repository.update(id, payload);
            if (!response) {
                throw new HttpException(
                    'Something went wrong! Please try again.',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }

            if (this.auditLogService && response) {
                const changedFields: Record<string, { from: any; to: any }> = {};
                if (output.name !== response.name) changedFields['name'] = { from: output.name, to: response.name };
                if (output.price !== response.price) changedFields['price'] = { from: output.price, to: response.price };
                if (output.quantity !== response.quantity) changedFields['quantity'] = { from: output.quantity, to: response.quantity };

                this.auditLogService.createAsyncLog({
                    actorId: null,
                    actorName: null,
                    actorEmail: null,
                    actorRole: 'admin',
                    action: AuditAction.PRODUCT_UPDATED,
                    module: AuditModule.PRODUCT,
                    targetId: response.id,
                    targetType: AuditTargetType.PRODUCT,
                    status: 'SUCCESS',
                    changes: {
                        type: 'FIELD_DIFF',
                        changedFields: Object.keys(changedFields).length > 0 ? changedFields : {
                            updatedAt: { from: output.updatedAt, to: response.updatedAt }
                        }
                    }
                });
            }

            return ResponseUtils.successResponseHandler(200, 'Data updated successfully.', 'data', response);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateProductStaus(id: string, dto: UpdateProductStatusDto): Promise<ApiResponse<Product>> {
        try {
            const response = await this.repository.update(id , dto);
            if (!response) {
                throw new HttpException(
                    'Something went wrong! Please try again.',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }
            return ResponseUtils.successResponseHandler(200, 'Data updated successfully.', 'data', response);
        } catch (error) {
            throw new HttpException(
                error instanceof Error ? error.message : 'Internal Server Error',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async remove(id: string): Promise<ApiResponse<boolean>> {
        try {
            const output = await this.repository.findOne(id);
            if (!output) {
                throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
            }
            const response = await this.repository.softDelete(id);
            const result = response !== null;
            return ResponseUtils.deleteResponseHandler(200, 'Data deleted successfully.', result);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }
}
