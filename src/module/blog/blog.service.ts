import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { FindOptionsOrder } from 'typeorm';
import { BlogRepository } from './blog.repository';
import { CreateBlogDto } from './dto/create-blog.dto';
import { BlogInterface } from './type/blog.type';
import { Blog } from './entities/blog.entity';
import { BlogFilterDto } from './dto/blog-filter.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

@Injectable()
export class BlogService {
	constructor(
		private readonly spaceService: SpaceService,
		private readonly repository: BlogRepository
	) { }

	async create(
		dto: CreateBlogDto,
		files: {
			image?: UploadMulterFile
		}
	): Promise<ApiResponse<BlogInterface>> {
		try {
			const slug = this.generateSlug(dto.title);
			const existingBlog = await this.repository.findBySlug(slug);
			if (existingBlog) {
				throw new HttpException(
					'Blog already exists.',
					HttpStatus.BAD_REQUEST
				);
			}
			if (files && files.image) {
				const image: any = await this.spaceService.uploadFile(files.image[0], "blog");
				dto.image = image;
			}
			const output = (await this.repository.create({ ...dto, slug })) as Blog | null;
			if (!output) {
				throw new HttpException(
					'Something went wrong! Please try again.',
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			return ResponseUtils.successResponseHandler(201, 'Data saved successfully.', 'data', output);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async findAll(dto: BlogFilterDto): Promise<ApiResponse<{ data: BlogInterface[]; total: number; page: number; limit: number; pageCount: number; }>> {
		try {
			let query = {};

			const order: FindOptionsOrder<Blog> = {
				createdAt: 'desc'
			};

			const result = await this.repository.paginate({
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

	async findOne(id: string): Promise<ApiResponse<Blog>> {
		try {
			const data = await this.repository.findOne(id);
			if (!data) {
				throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
			}
			return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async update(
		id: string,
		data: UpdateBlogDto,
		files: {
			image?: UploadMulterFile
		}
	): Promise<ApiResponse<Blog>> {
		try {
			const output = await this.repository.findOne(id);
			if (!output) {
				throw new HttpException('Data does not exist!', HttpStatus.BAD_REQUEST);
			}
			if (data.title) {
				const slug = this.generateSlug(data.title);
				const existingBlog = await this.repository.findBySlug(slug);
				if (existingBlog && existingBlog.id !== id) {
					throw new HttpException('Blog already exists.', HttpStatus.BAD_REQUEST);
				}
				data.slug = slug;
			}
			const foundImage = (output as Blog)?.image;
			if (files && files.image) {
				const image: any = await this.spaceService.uploadFile(files.image[0], "blog");
				data.image = image;
			} else {
				data.image = foundImage;
			}
			const response = await this.repository.update(id, data);
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
