import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateFirstCategoryDto {
    @IsNotEmpty()
    name: string;

    @IsOptional()
    bannerImage: string;

    @IsOptional()
    image: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    status: boolean;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    showOnHome?: boolean;

    @IsNotEmpty()
    mainCategoryId: string;

    @IsNotEmpty()
    mainCategoryName: string;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null || value === '') return 9999;
        const val = Number(value);
        return isNaN(val) ? 9999 : val;
    })
    position?: number;
}
