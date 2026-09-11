import { HttpException, HttpStatus, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { Notifications, NotificationType } from './entity/notification.entity';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';
import { EntityManager, In } from 'typeorm';
import { Role } from '../../enums/role.enum';
import { SocketService } from '../socket/socket.service';
import { SocketEvent, SOCKET_ROOMS } from '../socket/socket.constants';

@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(
    private readonly repository: NotificationRepository,
    @Optional() private readonly socketService?: SocketService
  ) {}

  async onModuleInit() {
    try {
      await this.repository.query(`
        CREATE TABLE IF NOT EXISTS \`notifications\` (
          \`id\` varchar(36) NOT NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          \`isDeleted\` tinyint(4) NOT NULL DEFAULT 0,
          \`userId\` varchar(255) DEFAULT NULL,
          \`role\` varchar(50) DEFAULT 'CUSTOMER',
          \`title\` varchar(255) NOT NULL,
          \`message\` text NOT NULL,
          \`type\` varchar(100) NOT NULL DEFAULT 'GENERAL',
          \`orderId\` varchar(255) DEFAULT NULL,
          \`metadata\` json DEFAULT NULL,
          \`isRead\` tinyint(4) NOT NULL DEFAULT 0,
          PRIMARY KEY (\`id\`),
          KEY \`IDX_notifications_userId\` (\`userId\`),
          KEY \`IDX_notifications_role_createdAt\` (\`role\`, \`createdAt\`),
          KEY \`IDX_notifications_role_isRead_createdAt\` (\`role\`, \`isRead\`, \`createdAt\`),
          UNIQUE KEY \`UNQ_notifications_type_orderId\` (\`type\`, \`orderId\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (err) {
      console.error('Auto table creation error for notifications:', err);
    }

    try {
      await this.repository.query(`ALTER TABLE \`notifications\` MODIFY COLUMN \`userId\` varchar(255) NULL`);
    } catch (e) {}

    try {
      await this.repository.query(`ALTER TABLE \`notifications\` ADD COLUMN \`role\` varchar(50) NOT NULL DEFAULT 'CUSTOMER'`);
    } catch (e) {}

    try {
      await this.repository.query(`ALTER TABLE \`notifications\` ADD COLUMN \`metadata\` json NULL`);
    } catch (e) {}

    try {
      await this.repository.query(`ALTER TABLE \`notifications\` DROP INDEX \`UNQ_notifications_type_orderId\``);
    } catch (e) {}
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
        role: item.role || 'user',
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

  async findAdminNotifications(after?: string | number, limit: number = 20): Promise<
    ApiResponse<{ items: any[]; unreadCount: number; nextCursor?: string | null }>
  > {
    try {
      let limitNum = typeof after === 'number' ? after : limit;
      let afterCursor = typeof after === 'string' ? after : undefined;
      const take = Math.max(1, Math.min(Number(limitNum) || 20, 100));

      const list = await this.repository.findAllWithOrder(
        { role: In([Role.ADMIN, 'admin', 'ADMIN']), isDeleted: false },
        { createdAt: 'DESC' }
      );

      let filtered = list;
      if (afterCursor) {
        const afterIdx = list.findIndex((item) => item.id === afterCursor);
        if (afterIdx !== -1) {
          filtered = list.slice(afterIdx + 1);
        }
      }

      const paginated = filtered.slice(0, take);
      const mapped = paginated.map((item) => {
        let parsedMetadata = item.metadata;
        if (typeof parsedMetadata === 'string') {
          try {
            parsedMetadata = JSON.parse(parsedMetadata);
          } catch {
            parsedMetadata = {};
          }
        }

        return {
          id: item.id,
          _id: item.id,
          type: item.type,
          orderId: item.orderId,
          role: item.role || Role.ADMIN,
          isRead: item.isRead,
          title: item.title,
          message: item.message,
          metadata: parsedMetadata || {},
          createdAt: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString(),
        };
      });

      const unreadCount = list.filter((n) => !n.isRead).length;
      const nextCursor = paginated.length === take ? paginated[paginated.length - 1].id : null;

      return ResponseUtils.successResponseHandler(
        200,
        'Admin notifications fetched successfully.',
        'data',
        { items: mapped, unreadCount, nextCursor }
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
      if (notif.userId && notif.userId !== userId) {
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

  async markAdminNotificationRead(id: string): Promise<ApiResponse<boolean>> {
    try {
      const notif = await this.repository.findOne(id);
      if (notif) {
        notif.isRead = true;
        await this.repository.save(notif);
      }
      return ResponseUtils.successResponseHandler(200, 'Admin notification marked as read.', 'data', true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async markAdminAsRead(id: string): Promise<ApiResponse<boolean>> {
    return await this.markAdminNotificationRead(id);
  }

  async markAllAdminNotificationsRead(): Promise<ApiResponse<boolean>> {
    try {
      const unread = await this.repository.findAll({
        role: In([Role.ADMIN, 'admin', 'ADMIN']),
        isRead: false,
        isDeleted: false,
      });
      if (unread.length > 0) {
        const updated = unread.map((item) => {
          item.isRead = true;
          return item;
        });
        await this.repository.save(updated);
      }

      return ResponseUtils.successResponseHandler(200, 'All admin notifications marked as read.', 'data', true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async markAllAdminAsRead(): Promise<ApiResponse<boolean>> {
    return await this.markAllAdminNotificationsRead();
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

  async createAdminOrderNotification(
    managerOrData: EntityManager | {
      orderId: string;
      orderNumber?: string;
      customerName?: string;
      totalAmount?: number;
      currency?: string;
      paymentMethod?: string;
    } | null,
    maybeData?: {
      orderId: string;
      orderNumber?: string;
      customerName?: string;
      totalAmount?: number;
      currency?: string;
      paymentMethod?: string;
    }
  ): Promise<Notifications | null> {
    try {
      let manager: EntityManager | null = null;
      let data: any = {};

      if (managerOrData && 'create' in (managerOrData as any)) {
        manager = managerOrData as EntityManager;
        data = maybeData || {};
      } else {
        data = (managerOrData as any) || {};
      }

      const orderNumber = data.orderNumber || data.orderId || '';
      const displayId = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;
      const customer = (data.customerName || '').trim() || 'A customer';
      const amountStr = data.totalAmount ? `৳${data.totalAmount.toLocaleString()}` : '';
      const title = '🎉 New Order Placed';
      const message = `${customer} placed a new order ${displayId}${amountStr ? ` for ${amountStr}` : ''}.`;

      const notifData = {
        role: Role.ADMIN,
        type: 'ORDER_PLACED' as NotificationType,
        orderId: data.orderId || orderNumber,
        title,
        message,
        metadata: {
          orderNumber,
          customerName: customer,
          totalAmount: data.totalAmount || 0,
          currency: data.currency || 'BDT',
          paymentMethod: data.paymentMethod || 'COD',
        },
        isRead: false,
      };

      let savedNotif: Notifications | null = null;
      if (manager && 'create' in manager) {
        const notifEntity = manager.create(Notifications, notifData);
        savedNotif = await manager.save(Notifications, notifEntity);
      } else {
        savedNotif = await this.repository.create(notifData);
      }

      if (savedNotif && this.socketService) {
        try {
          this.socketService.emitToRoom(SOCKET_ROOMS.ADMIN_ROOM, SocketEvent.ADMIN_NOTIFICATION, {
            id: savedNotif.id,
            type: savedNotif.type,
            title: savedNotif.title,
            message: savedNotif.message,
            createdAt: savedNotif.createdAt ? new Date(savedNotif.createdAt).toISOString() : new Date().toISOString()
          });
        } catch (socketErr) {}
      }

      return savedNotif;
    } catch (err) {
      console.error('Error creating admin order notification in DB (Idempotency check / duplicate prevented):', err);
      return null;
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
      const cleanStatus = (status || 'Updated').trim();
      const typeMap: Record<string, NotificationType> = {
        Pending: 'ORDER_PLACED' as NotificationType,
        'Order Placed': 'ORDER_PLACED' as NotificationType,
        Processing: 'ORDER_PROCESSING' as NotificationType,
        'Preparing Order': 'ORDER_PROCESSING' as NotificationType,
        Shipped: 'ORDER_SHIPPED' as NotificationType,
        'Loaded for Delivery': 'ORDER_SHIPPED' as NotificationType,
        'Handed Over to Courier': 'ORDER_SHIPPED' as NotificationType,
        'Out for Delivery': 'ORDER_SHIPPED' as NotificationType,
        Delivered: 'ORDER_DELIVERED' as NotificationType,
        Completed: 'ORDER_DELIVERED' as NotificationType,
        Rejected: 'ORDER_CANCELLED' as NotificationType,
        Cancelled: 'ORDER_CANCELLED' as NotificationType,
        Returned: 'ORDER_CANCELLED' as NotificationType,
        Failed: 'ORDER_CANCELLED' as NotificationType,
      };

      const notifType: NotificationType = typeMap[cleanStatus] || (`ORDER_STATUS_${cleanStatus.toUpperCase().replace(/\s+/g, '_')}` as NotificationType);
      const displayId = orderId.startsWith('#') ? orderId : `#${orderId}`;

      const title = `Order Status: ${cleanStatus}`;
      const message =
        note || `Your order ${displayId} status has been updated to "${cleanStatus}".`;

      const notification = await this.repository.create({
        userId,
        role: Role.CUSTOMER,
        orderId,
        title,
        message,
        type: notifType,
        isRead: false,
      });

      if (notification && this.socketService) {
        try {
          this.socketService.emitToRoom(SOCKET_ROOMS.USER(userId), SocketEvent.ORDER_STATUS_UPDATED, {
            id: notification.id,
            userId,
            orderId,
            status: cleanStatus,
            title: notification.title,
            message: notification.message,
            createdAt: notification.createdAt ? new Date(notification.createdAt).toISOString() : new Date().toISOString()
          });
        } catch (socketErr) {}
      }

      return notification;
    } catch (err) {
      console.error('Error creating order notification in DB:', err);
      return null;
    }
  }
}

