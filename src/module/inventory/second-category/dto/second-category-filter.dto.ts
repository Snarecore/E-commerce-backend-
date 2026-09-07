import { FilterDto } from "../../../core/dto/filter.dto";
import { IsOptional, IsString } from "class-validator";

export class SecondCategoryFilterDto extends FilterDto {
    @IsOptional()
    @IsString()
    mainCategoryId?: string;

    @IsOptional()
    @IsString()
    firstCategoryId?: string;
}
