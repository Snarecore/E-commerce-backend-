import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { PolicyTwoCms } from './entities/policy-two-cms.entity';
import { PolicyTwoCmsController } from './policy-two-cms.controller';
import { PolicyTwoCmsService } from './policy-two-cms.service';
import { PolicyTwoCmsRepository } from './policy-two-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyTwoCms])
	],
	controllers: [PolicyTwoCmsController],
	providers: [PolicyTwoCmsService, PolicyTwoCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicyTwoCmsService, PolicyTwoCmsRepository]
})

export class PolicyTwoCmsModule {}
