import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ShipmentStatus } from '../enums/shipment-status.enum';

export class CreateShipmentDto {
    @IsOptional()
    @IsString()
    @MaxLength(250)
    note?: string;
}

export class CancelShipmentDto {
    @IsOptional()
    @IsString()
    @MaxLength(250)
    reason?: string;
}

export class LinkConsignmentDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^[0-9]{1,20}$/, { message: 'consignmentId must be numeric.' })
    consignmentId: string;

    @IsOptional()
    @IsString()
    @Matches(/^[A-Za-z0-9]{1,40}$/, { message: 'trackingCode must be alphanumeric.' })
    trackingCode?: string;
}

export class ResolveAttentionDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}

export class SettleCodDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    reference?: string;
}

export class ShipmentListFilterDto {
    @IsOptional()
    @IsIn(Object.values(ShipmentStatus))
    status?: string;

    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    needsAttention?: boolean;

    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    codUnsettled?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    q?: string;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsInt()
    @Min(1)
    limit?: number;
}

export class ReadyOrdersFilterDto {
    @IsOptional()
    @IsString()
    @MaxLength(64)
    q?: string;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}

export class BulkCreateShipmentsDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(50)
    @IsUUID('all', { each: true })
    orderIds: string[];
}

export class BulkSettleCodDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(200)
    @IsUUID('all', { each: true })
    shipmentIds: string[];

    @IsOptional()
    @IsString()
    @MaxLength(100)
    reference?: string;
}
