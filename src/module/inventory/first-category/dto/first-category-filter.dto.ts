import { FilterDto } from "../../../core/dto/filter.dto";
import { IsOptional, IsString } from "class-validator";

export class FirstCategoryFilterDto extends FilterDto {
    @IsOptional()
    @IsString()
    mainCategoryId?: string;
}
