import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FirstCategoryRepository } from './first-category.repository';
import { CreateFirstCategoryDto } from './dto/create-first-category.dto';
import { FirstCategoryInterface } from './type/first-category.type';
import { FirstCategory } from './entities/first-category.entity';
import { UpdateFirstCategoryDto } from './dto/update-first-category.dto';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { FirstCategoryFilterDto } from './dto/first-category-filter.dto';
import { FindOptionsOrder } from 'typeorm';

@Injectable()
export class FirstCategoryService {
    constructor(
        private readonly spaceService: SpaceService,
        private readonly repository: FirstCategoryRepository
    ) {}

    async create(
        dto: CreateFirstCategoryDto,
        files: {
            bannerImage?: UploadMulterFile;
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<FirstCategoryInterface>> {
        try {
            const slug = this.generateSlug(dto.name);
            const existingCategory = await this.repository.findBySlug(slug);
            if (existingCategory) {
                throw new HttpException('Category already exists.', HttpStatus.BAD_REQUEST);
            }

            if (files && files.bannerImage) {
                const bannerImage: any = await this.spaceService.uploadFile(
                    files.bannerImage[0],
                    'first-category'
                );
                dto.bannerImage = bannerImage;
            }

            if (files && files.image) {
                const image: any = await this.spaceService.uploadFile(
                    files.image[0],
                    'first-category'
                );
                dto.image = image;
            }

            const output = (await this.repository.create({ ...dto, slug })) as FirstCategory | null;
            if (!output) {
                throw new HttpException(
                    'Something went wrong! Please try again.',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }
            return ResponseUtils.successResponseHandler(
                201,
                'Data saved successfully.',
                'data',
                output
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findAll(
        dto: FirstCategoryFilterDto
    ): Promise<
        ApiResponse<{
            data: FirstCategoryInterface[];
            total: number;
            page: number;
            limit: number;
            pageCount: number;
        }>
    > {
        try {
            let query = {};

            const order: FindOptionsOrder<FirstCategory> = {
                position: 'asc',
                createdAt: 'desc',
            };

            const result = await this.repository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order,
            });

            const payload = {
                data: result?.data,
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

    async findOne(id: string): Promise<ApiResponse<FirstCategory>> {
        try {
            const data = await this.repository.findOne(id);
            if (!data) {
                throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
            }
            return ResponseUtils.successResponseHandler(
                200,
                'Data retrieved successfully.',
                'data',
                data
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async update(
        id: string,
        dto: UpdateFirstCategoryDto,
        files: {
            bannerImage?: UploadMulterFile;
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<FirstCategory>> {
        try {
            const output = await this.repository.findOne(id);
            if (!output) {
                throw new HttpException('Data does not exist!', HttpStatus.BAD_REQUEST);
            }

            if (dto.name) {
                const slug = this.generateSlug(dto.name);
                const existingCategory = await this.repository.findBySlug(slug);
                if (existingCategory && existingCategory.id !== id) {
                    throw new HttpException('Category already exists.', HttpStatus.BAD_REQUEST);
                }
                dto = { ...dto, slug };
            }

            const foundImage = (output as FirstCategory)?.bannerImage;
            if (files && files.bannerImage) {
                const bannerImage: any = await this.spaceService.uploadFile(
                    files.bannerImage[0],
                    'first-category'
                );
                dto.bannerImage = bannerImage;
            } else {
                dto.bannerImage = foundImage;
            }

            const foundIcon = (output as FirstCategory)?.image;
            if (files && files.image) {
                const image: any = await this.spaceService.uploadFile(
                    files.image[0],
                    'first-category'
                );
                dto.image = image;
            } else {
                dto.image = foundIcon;
            }

            const response = await this.repository.update(id, dto);
            if (!response) {
                throw new HttpException(
                    'Something went wrong! Please try again.',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }
            return ResponseUtils.successResponseHandler(
                200,
                'Data updated successfully.',
                'data',
                response
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
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
