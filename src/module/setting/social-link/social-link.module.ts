import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../space-module/space-service/space.service';
import { SocialLink } from './entities/social-link.entity';
import { SocialLinkController } from './social-link.controller';
import { SocialLinkService } from './social-link.service';
import { SocialLinkRepository } from './social-link.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([SocialLink])
	],
	controllers: [SocialLinkController],
	providers: [SocialLinkService, SocialLinkRepository, SpaceService],
	exports: [SocialLinkService, SocialLinkRepository]
})

export class SocialLinkModule {}
