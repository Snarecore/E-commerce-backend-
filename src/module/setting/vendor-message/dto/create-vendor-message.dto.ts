import { IsNotEmpty } from 'class-validator';

export class CreateVendorMessageDto {
    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    message: string;

    @IsNotEmpty()
    vendorId: string;
}
