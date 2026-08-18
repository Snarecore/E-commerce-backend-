import { Module } from '@nestjs/common';
import { R2ServiceProvider } from './space-service';
import { SpaceService } from './space-service/space.service';

@Module({
    imports: [],
    controllers: [],
    providers: [R2ServiceProvider, SpaceService]
})
export class SpaceModule {}