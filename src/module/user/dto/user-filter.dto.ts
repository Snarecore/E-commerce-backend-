import { IsOptional } from "class-validator";
import { Role } from "../../../enums/role.enum";
import { FilterDto } from "../../core/dto/filter.dto";

export class UserFilterDto extends FilterDto {
    @IsOptional()
    role?: Role;
}