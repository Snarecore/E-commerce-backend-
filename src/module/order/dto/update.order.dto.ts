import { PartialType } from '@nestjs/mapped-types';
import { CreateOrdersDto } from './create-order.dto';

export class UpdateOrdersDto extends PartialType(CreateOrdersDto) {}
