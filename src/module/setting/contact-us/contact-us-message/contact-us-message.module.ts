import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { ContactUsMessage } from './entities/contact-us-message.entity';
import { ContactUsMessageController } from './contact-us-messages.controller';
import { ContactUsMessageService } from './contact-us-message.service';
import { ContactUsMessageRepository } from './contact-us-message.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ContactUsMessage])
	],
	controllers: [ContactUsMessageController],
	providers: [ContactUsMessageService, ContactUsMessageRepository, SpaceService, R2ServiceProvider],
	exports: [ContactUsMessageService, ContactUsMessageRepository]
})

export class ContactUsMessageModule {}
