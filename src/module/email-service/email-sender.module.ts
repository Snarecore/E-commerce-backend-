import { Module } from '@nestjs/common';
import { EmailService } from './email-sender.service';

@Module({
	controllers: [],
	providers: [EmailService],
	exports: [EmailService],
	imports: []
})
export class EmailServiceModule { }
