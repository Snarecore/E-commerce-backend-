import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email-sender.service';
import { EmailSettingModule } from '../setting/email-setting/email-setting.module';

@Module({
	controllers: [],
	providers: [EmailService],
	exports: [EmailService],
	imports: [forwardRef(() => EmailSettingModule)]
})
export class EmailServiceModule { }
