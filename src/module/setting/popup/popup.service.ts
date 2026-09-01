import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PopupRepository } from './popup.repository';
import { CreatePopupDto } from './dto/create-popup.dto';
import { UpdatePopupDto } from './dto/update-popup.dto';
import { PopupFilterDto } from './dto/popup-filter.dto';
import { Popup } from './entities/popup.entity';
import { UploadMulterFile } from '../../space-module/space-service';
import { SpaceService } from '../../space-module/space-service/space.service';
import { ApiResponse, ResponseUtils } from '../../../utils/response.utils';
import { FindOptionsOrder, Like } from 'typeorm';

@Injectable()
export class PopupService {
    constructor(
        private readonly spaceService: SpaceService,
        private readonly repository: PopupRepository
    ) {}

    private cleanString(val: any): string | undefined {
        if (!val || val === 'undefined' || val === 'null' || typeof val !== 'string' || !val.trim()) {
            return undefined;
        }
        return val.trim();
    }

    private validateDateRange(startDate?: string | Date, endDate?: string | Date) {
        if (startDate && endDate && startDate !== 'undefined' && endDate !== 'undefined') {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new BadRequestException('Invalid date format provided.');
            }
            if (start >= end) {
                throw new BadRequestException('startDate must be strictly earlier than endDate.');
            }
        }
    }

    async create(
        dto: CreatePopupDto,
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<Popup>> {
        try {
            if (!files || !files.image || !files.image[0]) {
                throw new BadRequestException('Popup image is required.');
            }

            const cleanStartDate = this.cleanString(dto.startDate);
            const cleanEndDate = this.cleanString(dto.endDate);
            this.validateDateRange(cleanStartDate, cleanEndDate);

            const uploadedImage = await this.spaceService.uploadFile(files.image[0], 'popups');
            if (!uploadedImage) {
                throw new HttpException('Failed to upload image. Please try again.', HttpStatus.INTERNAL_SERVER_ERROR);
            }

            dto.image = uploadedImage;

            const payload: Partial<Popup> = {
                title: this.cleanString(dto.title),
                description: this.cleanString(dto.description),
                image: uploadedImage,
                link: this.cleanString(dto.link),
                priority: dto.priority !== undefined && !isNaN(Number(dto.priority)) ? Number(dto.priority) : 0,
                startDate: cleanStartDate ? new Date(cleanStartDate) : undefined,
                endDate: cleanEndDate ? new Date(cleanEndDate) : undefined,
                isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true
            };

            const output = await this.repository.create(payload);
            if (!output) {
                throw new HttpException('Something went wrong while saving popup.', HttpStatus.INTERNAL_SERVER_ERROR);
            }

            return ResponseUtils.successResponseHandler(201, 'Popup created successfully.', 'data', output);
        } catch (error: unknown) {
            if (error instanceof BadRequestException || error instanceof HttpException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findAll(dto: PopupFilterDto): Promise<
        ApiResponse<{
            data: Popup[];
            total: number;
            page: number;
            limit: number;
            pageCount: number;
        }>
    > {
        try {
            let query: any = {};
            if (dto.search && dto.search.trim()) {
                query = {
                    title: Like(`%${dto.search.trim()}%`)
                };
            }

            const order: FindOptionsOrder<Popup> = {
                priority: 'DESC',
                createdAt: 'DESC'
            };

            const result = await this.repository.paginate({
                page: dto.page ? Number(dto.page) : 1,
                limit: dto.limit ? Number(dto.limit) : 10,
                query,
                order
            });

            const payload = {
                data: result?.data || [],
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount
            };

            return ResponseUtils.successResponseHandler(200, 'Popups retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findOne(id: string): Promise<ApiResponse<Popup>> {
        try {
            const data = await this.repository.findOne(id);
            if (!data) {
                throw new BadRequestException('Popup not found.');
            }
            return ResponseUtils.successResponseHandler(200, 'Popup retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async update(
        id: string,
        dto: UpdatePopupDto,
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<Popup>> {
        try {
            const existing = await this.repository.findOne(id);
            if (!existing) {
                throw new BadRequestException('Popup not found.');
            }

            const cleanStartDate = dto.startDate !== undefined ? this.cleanString(dto.startDate) : undefined;
            const cleanEndDate = dto.endDate !== undefined ? this.cleanString(dto.endDate) : undefined;

            const effectiveStartDate = cleanStartDate !== undefined ? cleanStartDate : existing.startDate;
            const effectiveEndDate = cleanEndDate !== undefined ? cleanEndDate : existing.endDate;
            this.validateDateRange(effectiveStartDate, effectiveEndDate);

            let finalImage = existing.image;
            if (files && files.image && files.image[0]) {
                const uploadedImage = await this.spaceService.uploadFile(files.image[0], 'popups');
                if (uploadedImage) {
                    finalImage = uploadedImage;
                }
            }

            const updatePayload: any = {
                image: finalImage,
                title: dto.title !== undefined ? this.cleanString(dto.title) || null : existing.title,
                description: dto.description !== undefined ? this.cleanString(dto.description) || null : existing.description,
                link: dto.link !== undefined ? this.cleanString(dto.link) || null : existing.link,
                priority: dto.priority !== undefined ? Number(dto.priority) || 0 : existing.priority,
                startDate: cleanStartDate !== undefined ? (cleanStartDate ? new Date(cleanStartDate) : null) : existing.startDate,
                endDate: cleanEndDate !== undefined ? (cleanEndDate ? new Date(cleanEndDate) : null) : existing.endDate,
                isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive
            };

            const response = await this.repository.update(id, updatePayload);
            if (!response) {
                throw new HttpException('Something went wrong while updating popup.', HttpStatus.INTERNAL_SERVER_ERROR);
            }

            return ResponseUtils.successResponseHandler(200, 'Popup updated successfully.', 'data', response);
        } catch (error: unknown) {
            if (error instanceof BadRequestException || error instanceof HttpException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async remove(id: string): Promise<ApiResponse<boolean>> {
        try {
            const existing = await this.repository.findOne(id);
            if (!existing) {
                throw new BadRequestException('Popup not found.');
            }
            const response = await this.repository.softDelete(id);
            const result = response !== null;
            return ResponseUtils.deleteResponseHandler(200, 'Popup deleted successfully.', result);
        } catch (error: unknown) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getActivePopup(): Promise<ApiResponse<Popup | null>> {
        try {
            const popup = await this.repository.getActivePopup();
            return ResponseUtils.successResponseHandler(200, 'Active popup retrieved successfully.', 'data', popup || null);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
