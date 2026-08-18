import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePromotionsDto {
    @IsOptional()
    image: string;

    @IsNotEmpty()
    link: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    status: boolean;
}
