import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './notification.repository';
import { SocketService } from '../socket/socket.service';
import { Role } from '../../enums/role.enum';
import { SocketEvent, SOCKET_ROOMS } from '../socket/socket.constants';

describe('NotificationService', () => {
    let service: NotificationService;
    let repositoryMock: any;
    let socketServiceMock: any;

    beforeEach(async () => {
        repositoryMock = {
            create: jest.fn((data) => Promise.resolve({ id: 'notif-101', ...data, createdAt: new Date() })),
            findAllWithOrder: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn((data) => Promise.resolve(data))
        };

        socketServiceMock = {
            emitToRoom: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationService,
                { provide: NotificationRepository, useValue: repositoryMock },
                { provide: SocketService, useValue: socketServiceMock }
            ]
        }).compile();

        service = module.get<NotificationService>(NotificationService);
    });

    it('creates an in-app customer notification and emits socket event to user room', async () => {
        const notif = await service.createOrderNotification(
            'customer-user-1',
            'BB123456',
            'Order Placed',
            'Your order #BB123456 has been placed successfully!'
        );

        expect(repositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'customer-user-1',
            role: Role.CUSTOMER,
            orderId: 'BB123456',
            title: 'Order Status: Order Placed',
            type: 'ORDER_PLACED',
            isRead: false
        }));

        expect(socketServiceMock.emitToRoom).toHaveBeenCalledWith(
            SOCKET_ROOMS.USER('customer-user-1'),
            SocketEvent.ORDER_STATUS_UPDATED,
            expect.objectContaining({
                userId: 'customer-user-1',
                orderId: 'BB123456',
                status: 'Order Placed'
            })
        );

        expect(notif?.id).toBe('notif-101');
    });

    it('fetches user notifications and computes unread count accurately', async () => {
        repositoryMock.findAllWithOrder.mockResolvedValue([
            { id: 'n1', orderId: 'BB001', title: 'Placed', message: 'Ok', type: 'ORDER_PLACED', isRead: false, createdAt: new Date() },
            { id: 'n2', orderId: 'BB002', title: 'Shipped', message: 'On way', type: 'ORDER_SHIPPED', isRead: true, createdAt: new Date() }
        ]);

        const res = await service.findUserNotifications('customer-user-1');

        expect(res.statusCode).toBe(200);
        expect(res.data?.notifications.length).toBe(2);
        expect(res.data?.unreadCount).toBe(1);
    });

    it('marks a user notification as read', async () => {
        repositoryMock.findOne.mockResolvedValue({
            id: 'n1',
            userId: 'customer-user-1',
            isRead: false
        });

        const res = await service.markAsRead('n1', 'customer-user-1');
        expect(res.statusCode).toBe(200);
        expect(repositoryMock.save).toHaveBeenCalledWith(expect.objectContaining({ isRead: true }));
    });
});
