import { Module } from '@nestjs/common';
import { SpaceService } from './space-service/space.service';

@Module({
    imports: [],
    controllers: [],
    providers: [SpaceService]
})
export class SpaceModule {}