import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { PolicyThreeCms } from './entities/policy-three-cms.entity';
import { PolicyThreeCmsController } from './policy-three-cms.controller';
import { PolicyThreeCmsService } from './policy-three-cms.service';
import { PolicyThreeCmsRepository } from './policy-three-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyThreeCms])
	],
	controllers: [PolicyThreeCmsController],
	providers: [PolicyThreeCmsService, PolicyThreeCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicyThreeCmsService, PolicyThreeCmsRepository]
})

export class PolicyThreeCmsModule {}
