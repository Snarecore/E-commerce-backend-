import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateBlogDto {
	@IsNotEmpty()
	title: string;

	@IsOptional()
	slug: string;

	@IsOptional()
	image: string;

	@IsOptional()
	imageAltText: string;

	@IsNotEmpty()
	description: string;

	@IsNotEmpty()
	author: string;

	@IsBoolean()
	@Transform(({ value }) => value === 'true' || value === true)
	status: boolean;
}
