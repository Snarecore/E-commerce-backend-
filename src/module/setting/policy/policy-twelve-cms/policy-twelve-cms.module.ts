import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { PolicyTwelveCms } from './entities/policy-twelve-cms.entity';
import { PolicyTwelveCmsController } from './policy-twelve-cms.controller';
import { PolicyTwelveCmsService } from './policy-twelve-cms.service';
import { PolicyTwelveCmsRepository } from './policy-twelve-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyTwelveCms])
	],
	controllers: [PolicyTwelveCmsController],
	providers: [PolicyTwelveCmsService, PolicyTwelveCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicyTwelveCmsService, PolicyTwelveCmsRepository]
})

export class PolicyTwelveCmsModule {}
