import { Controller, Get } from '@nestjs/common';
import { CONFIG } from '../../utils/config';
import { UniqueCodeGeneratorService } from './unique-code-generator.service';
import { Public } from '../../decorators/public.decorator';

@Controller({ path: "unique-code", version: CONFIG.API_VERSION })
export class UniqueCodeGeneratorController {
	constructor(private readonly service: UniqueCodeGeneratorService) { }

	@Public()
	@Get('/product')
	async getUniqueProductCode() {
		return await this.service.getUniqueProductCode();
	}
}
