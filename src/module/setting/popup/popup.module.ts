import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Popup } from './entities/popup.entity';
import { PopupController } from './popup.controller';
import { PopupService } from './popup.service';
import { PopupRepository } from './popup.repository';
import { SpaceService } from '../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../space-module/space-service';

@Module({
    imports: [TypeOrmModule.forFeature([Popup])],
    controllers: [PopupController],
    providers: [PopupService, PopupRepository, SpaceService, R2ServiceProvider],
    exports: [PopupService, PopupRepository]
})
export class PopupModule {}
