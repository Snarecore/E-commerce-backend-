import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators/public.decorator';

@Controller()
export class AppController {
	@Public()
	@Get()
	getHello() {
		return { status: 'success', message: 'Cloth Backend API is running successfully' };
	}
}
