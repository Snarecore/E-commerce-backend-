import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../space-module/space-service';
import { VendorMessage } from './entities/vendor-message.entity';
import { VendorMessageController } from './vendor-message.controller';
import { VendorMessageService } from './vendor-message.service';
import { VendorMessageRepository } from './vendor-message.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([VendorMessage])
	],
	controllers: [VendorMessageController],
	providers: [VendorMessageService, VendorMessageRepository, SpaceService, R2ServiceProvider],
	exports: [VendorMessageService, VendorMessageRepository]
})

export class VendorMessageModule {}
