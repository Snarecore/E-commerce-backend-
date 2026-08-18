import { IsNotEmpty } from 'class-validator';

export class CreateContactUsMessageDto {
    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    phone: string;

    @IsNotEmpty()
    message: string;
}
