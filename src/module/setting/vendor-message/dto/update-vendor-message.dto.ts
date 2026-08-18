import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorMessageDto } from './create-vendor-message.dto';

export class UpdateVendorMessageDto extends PartialType(CreateVendorMessageDto) {}
