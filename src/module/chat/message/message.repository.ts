import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessageRepository extends AbstractRepository<Message> {
    constructor(dataSource: DataSource) {
        super(dataSource, Message);
    }
}
