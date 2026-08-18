import { Module } from '@nestjs/common';
import { EmailService } from './email-sender.service';

@Module({
	controllers: [],
	providers: [EmailService],
	imports: []
})
export class EmailServiceModule { }
