import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { ProductRepository } from './product.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductInterface } from './type/product.type';
import { Product } from './entities/product.entity';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductImageGalleryRepository } from '../product-image-gallery/product-image-gallery.repository';
import { Between, FindOptionsOrder, ILike, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { ProductFilter } from './type/product-filter.type';
import { ProductFilterDto } from './dto/product-filter.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';

@Injectable()
export class ProductService {
    constructor(
        private readonly spaceService: SpaceService,
        private readonly repository: ProductRepository,
        private readonly productImageGalleryRepository: ProductImageGalleryRepository
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

            if (files && files.featuredImage) {
                const featuredImage = await this.spaceService.uploadFile(
                    files.featuredImage[0],
                    'product'
                );
                dto.featuredImage = featuredImage;
            }

            if (files && files.fileUrl) {
                const fileUrl = await this.spaceService.uploadFile(files.fileUrl[0], 'product');
                dto.fileUrl = fileUrl;
            }

            const output = (await this.repository.create({ ...dto, slug, isApprove: true, status: true })) as Product | null;
            if (!output) {
                throw new HttpException(
                    'Something went wrong! Please try again.',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }

            if (files && files.productImages) {
                for (const image of files.productImages) {
                    const productImage = await this.spaceService.uploadFile(image, 'product');
                    await this.productImageGalleryRepository.create({
                        productId: output.id,
                        imageUrl: productImage
                    });
                }
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
            let query: ProductFilter = {};
            if (dto.searchKeyword) {
                query.name = ILike(`%${dto.searchKeyword}%`);
            }

            if (typeof dto.isActive === 'boolean') {
                query.status = dto.isActive;
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
                createdAt: 'desc',
            };

            const result = await this.repository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order,
            });

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

            dto.featuredImage = output.featuredImage;
            if (files?.featuredImage?.[0]) {
                const imageUrl = await this.spaceService.uploadFile(
                    files.featuredImage[0],
                    'product'
                );
                dto.featuredImage = imageUrl;
            }

			dto.fileUrl = output.fileUrl;
            if (files && files.fileUrl) {
                const fileUrl = await this.spaceService.uploadFile(files.fileUrl[0], 'product');
                dto.fileUrl = fileUrl;
            } else {
                dto.fileUrl = output.fileUrl;
            }

            const existingImages = dto.existingProductImages || [];
            const newProductImages: string[] = [];
            if (files?.productImages?.length) {
                for (const file of files.productImages) {
                    const imageUrl = await this.spaceService.uploadFile(file, 'product');
                    if (imageUrl) {
                        newProductImages.push(imageUrl);
                    }
                }
            }
            const finalProductImages = [...existingImages, ...newProductImages];
            await this.productImageGalleryRepository.deleteByQuery({ productId: id });
            for (const imageUrl of finalProductImages) {
                await this.productImageGalleryRepository.create({
                    productId: id,
                    imageUrl
                });
            }

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
