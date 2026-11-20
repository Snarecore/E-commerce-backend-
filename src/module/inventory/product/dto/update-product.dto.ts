import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProductDto extends PartialType(CreateProductDto) {
    @IsOptional()
    slug?: string;

    @IsOptional()
    existingProductImages?: string[];

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    status?: boolean;
}
