import { IsOptional } from 'class-validator';

export class BaseShopPageCmsDto {
    @IsOptional()
    bannerImage: string;
}
