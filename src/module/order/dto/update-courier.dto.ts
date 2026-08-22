import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateCourierDto {
    @IsNotEmpty()
    @IsString()
    courierName: string;

    @IsNotEmpty()
    @IsString()
    trackingId: string;

    @IsOptional()
    @IsUrl()
    courierTrackingLink?: string;
}
