import { IsOptional, IsUUID } from 'class-validator';
import { FilterDto } from 'src/module/core/dto/filter.dto';

export class VendorSubscriptionFilterDto extends FilterDto {
    @IsOptional()
    vendorId?: string;

    @IsOptional()
    tierId?: string;
}
