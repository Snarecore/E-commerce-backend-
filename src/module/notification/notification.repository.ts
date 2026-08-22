import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AbstractRepository } from 'src/database/abstract.repository';
import { Notifications } from './entity/notification.entity';

@Injectable()
export class NotificationRepository extends AbstractRepository<Notifications> {
  constructor(private readonly ds: DataSource) {
    super(ds, Notifications);
  }
}
