import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateMainCategoryDto {
    @IsNotEmpty()
    name: string;

    @IsOptional()
    image: string;

	@IsOptional()
	bannerImage: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    status: boolean;
}
