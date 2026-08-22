import { Column, Entity } from 'typeorm';
import { AbstractEntity } from 'src/database/abstract.entity';

export type NotificationType =
  | 'ORDER_PROCESSING'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'GENERAL';

@Entity('notifications')
export class Notifications extends AbstractEntity {
  @Column({ type: 'varchar', length: 255 })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 100, default: 'GENERAL' })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  orderId: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;
}
