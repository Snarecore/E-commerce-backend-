import { IsOptional } from "class-validator";
import { Role } from "src/enums/role.enum";
import { FilterDto } from "src/module/core/dto/filter.dto";

export class UserFilterDto extends FilterDto {
    @IsOptional()
    role?: Role;
}