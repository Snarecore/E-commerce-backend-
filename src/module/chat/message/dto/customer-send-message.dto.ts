import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CustomerSendMessageDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(2000)
    content: string;
}
