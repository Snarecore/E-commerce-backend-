import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { MegaDiscountService } from './mega-discount.service';
import { UpdateMegaDiscountDto } from './dto/update-mega-discount.dto';

@Controller({ path: 'setting/mega-discount', version: CONFIG.API_VERSION })
export class MegaDiscountController {
	constructor(private readonly megaDiscountService: MegaDiscountService) {}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get()
	async getMegaDiscount() {
		return await this.megaDiscountService.getMegaDiscount();
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Put()
	async updateMegaDiscount(@Body() dto: UpdateMegaDiscountDto) {
		return await this.megaDiscountService.updateMegaDiscount(dto);
	}
}
