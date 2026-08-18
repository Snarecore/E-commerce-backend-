import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSocialLinkDto {
    @IsOptional()
    icon: string;

    @IsNotEmpty()
    link: string;
}
