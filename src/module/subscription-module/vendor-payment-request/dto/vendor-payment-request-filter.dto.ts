import { IsOptional } from "class-validator";
import { FilterDto } from "src/module/core/dto/filter.dto";

export class VendorPaymentRequestFilterDto extends FilterDto {
    @IsOptional()
    vendorId?: string;
}