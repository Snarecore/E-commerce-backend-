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

    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null || value === '') return 9999;
        const val = Number(value);
        return isNaN(val) ? 9999 : val;
    })
    position?: number;
}
