import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';

export type NotificationType =
  | 'ORDER_PLACED'
  | 'ORDER_PROCESSING'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'NEW_ORDER'
  | 'GENERAL';

@Entity('notifications')
@Index(['role', 'createdAt'])
@Index(['role', 'isRead', 'createdAt'])
@Index(['type', 'orderId'], { unique: true })
export class Notifications extends AbstractEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'CUSTOMER' })
  role: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 100, default: 'GENERAL' })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  orderId: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;
}
