import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MegaDiscount } from './entities/mega-discount.entity';
import { MegaDiscountRepository } from './mega-discount.repository';
import { MegaDiscountService } from './mega-discount.service';
import { MegaDiscountController } from './mega-discount.controller';

@Module({
	imports: [TypeOrmModule.forFeature([MegaDiscount])],
	controllers: [MegaDiscountController],
	providers: [MegaDiscountService, MegaDiscountRepository],
	exports: [MegaDiscountService, MegaDiscountRepository]
})
export class MegaDiscountModule {}
