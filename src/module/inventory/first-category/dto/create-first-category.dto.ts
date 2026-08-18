import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateFirstCategoryDto {
    @IsNotEmpty()
    name: string;

    @IsOptional()
    bannerImage: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    status: boolean;

    @IsNotEmpty()
    mainCategoryId: string;

    @IsNotEmpty()
    mainCategoryName: string;
}
