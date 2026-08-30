import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { Notifications, NotificationType } from './entity/notification.entity';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';

@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(private readonly repository: NotificationRepository) {}

  async onModuleInit() {
    try {
      await this.repository.query(`
        CREATE TABLE IF NOT EXISTS \`notifications\` (
          \`id\` varchar(36) NOT NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          \`isDeleted\` tinyint(4) NOT NULL DEFAULT 0,
          \`userId\` varchar(255) NOT NULL,
          \`title\` varchar(255) NOT NULL,
          \`message\` text NOT NULL,
          \`type\` varchar(100) NOT NULL DEFAULT 'GENERAL',
          \`orderId\` varchar(255) DEFAULT NULL,
          \`isRead\` tinyint(4) NOT NULL DEFAULT 0,
          PRIMARY KEY (\`id\`),
          KEY \`IDX_notifications_userId\` (\`userId\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (err) {
      console.error('Auto table creation error for notifications:', err);
    }
  }

  async findUserNotifications(userId: string): Promise<
    ApiResponse<{ notifications: any[]; unreadCount: number }>
  > {
    try {
      const list = await this.repository.findAllWithOrder(
        { userId, isDeleted: false },
        { createdAt: 'DESC' }
      );

      const mapped = list.map((item) => ({
        _id: item.id,
        id: item.id,
        orderId: item.orderId,
        title: item.title,
        message: item.message,
        type: item.type,
        isRead: item.isRead,
        createdAt: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString(),
      }));

      const unreadCount = mapped.filter((n) => !n.isRead).length;

      return ResponseUtils.successResponseHandler(
        200,
        'Notifications fetched successfully.',
        'data',
        { notifications: mapped, unreadCount }
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async markAsRead(id: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      const notif = await this.repository.findOne(id);
      if (!notif) {
        throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
      }
      if (notif.userId !== userId) {
        throw new HttpException('Forbidden access', HttpStatus.FORBIDDEN);
      }

      notif.isRead = true;
      await this.repository.save(notif);

      return ResponseUtils.successResponseHandler(
        200,
        'Notification marked as read.',
        'data',
        true
      );
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const msg = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async markAllAsRead(userId: string): Promise<ApiResponse<boolean>> {
    try {
      const unread = await this.repository.findAll({ userId, isRead: false, isDeleted: false });
      if (unread.length > 0) {
        const updated = unread.map((item) => {
          item.isRead = true;
          return item;
        });
        await this.repository.save(updated);
      }

      return ResponseUtils.successResponseHandler(
        200,
        'All notifications marked as read.',
        'data',
        true
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createOrderNotification(
    userId: string,
    orderId: string,
    status: string,
    note?: string
  ): Promise<Notifications | null> {
    if (!userId) return null;

    try {
      const typeMap: Record<string, NotificationType> = {
        Processing: 'ORDER_PROCESSING',
        'Preparing Order': 'ORDER_PROCESSING',
        Shipped: 'ORDER_SHIPPED',
        'Loaded for Delivery': 'ORDER_SHIPPED',
        'Handed Over to Courier': 'ORDER_SHIPPED',
        'Out for Delivery': 'ORDER_SHIPPED',
        Delivered: 'ORDER_DELIVERED',
        Cancelled: 'ORDER_CANCELLED',
        Returned: 'ORDER_CANCELLED',
      };

      const notifType: NotificationType = typeMap[status] || 'GENERAL';
      const displayId = orderId.startsWith('#') ? orderId : `#${orderId}`;

      const title = `Order Status: ${status}`;
      const message =
        note || `Your order ${displayId} status has been updated to "${status}".`;

      const notification = await this.repository.create({
        userId,
        orderId,
        title,
        message,
        type: notifType,
        isRead: false,
      });

      return notification;
    } catch (err) {
      console.error('Error creating order notification in DB:', err);
      return null;
    }
  }
}
