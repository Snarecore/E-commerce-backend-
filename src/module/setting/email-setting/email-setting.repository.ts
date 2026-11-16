import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { EmailSetting } from './entities/email-setting.entity';

@Injectable()
export class EmailSettingRepository extends AbstractRepository<EmailSetting> {
    constructor(dataSource: DataSource) {
        super(dataSource, EmailSetting);
    }
}
