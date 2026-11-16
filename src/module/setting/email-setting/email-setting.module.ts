import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSetting } from './entities/email-setting.entity';
import { EmailSettingRepository } from './email-setting.repository';
import { EmailSettingService } from './email-setting.service';
import { EmailSettingController } from './email-setting.controller';
import { AuditLogModule } from '../../audit-log/audit-log.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([EmailSetting]),
        AuditLogModule
    ],
    controllers: [EmailSettingController],
    providers: [EmailSettingRepository, EmailSettingService],
    exports: [EmailSettingService, EmailSettingRepository]
})
export class EmailSettingModule {}
