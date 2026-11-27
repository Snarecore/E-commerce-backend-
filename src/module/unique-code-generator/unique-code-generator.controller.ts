import { Controller, Get } from '@nestjs/common';
import { CONFIG } from '../../utils/config';
import { UniqueCodeGeneratorService } from './unique-code-generator.service';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';

@Controller({ path: "unique-code", version: CONFIG.API_VERSION })
export class UniqueCodeGeneratorController {
	constructor(private readonly service: UniqueCodeGeneratorService) { }

	// Admin catalogue tool: each call reserves a code, so it must not be open to the public
	@Roles(Role.ADMIN)
	@Get('/product')
	async getUniqueProductCode() {
		return await this.service.getUniqueProductCode();
	}
}
