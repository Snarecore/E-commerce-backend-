import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditModule } from './constants/audit-module.enum';
import { AuditAction } from './constants/audit-action.enum';

describe('AuditLogService & Interceptor', () => {
    let service: AuditLogService;
    let repositoryMock: any;
    let interceptor: AuditLogInterceptor;

    beforeEach(async () => {
        repositoryMock = {
            create: jest.fn((dto) => dto),
            save: jest.fn((entity) => Promise.resolve({ id: 'log-1', ...entity, createdAt: new Date() })),
            findOne: jest.fn(),
            count: jest.fn().mockResolvedValue(100),
            createQueryBuilder: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                addOrderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([
                    [{ id: 'log-1', module: AuditModule.PRODUCT, action: AuditAction.PRODUCT_CREATED }],
                    1
                ]),
                getRawMany: jest.fn().mockResolvedValue([
                    { module: 'PRODUCT', count: '10' },
                    { module: 'ORDER', count: '8' }
                ])
            })
        };

        const dataSourceMock = {
            query: jest.fn().mockResolvedValue([])
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditLogService,
                AuditLogInterceptor,
                { provide: getRepositoryToken(AuditLog), useValue: repositoryMock },
                { provide: DataSource, useValue: dataSourceMock }
            ]
        }).compile();

        service = module.get<AuditLogService>(AuditLogService);
        interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
    });

    it('creates an async audit log with sanitized changes', async () => {
        const result = await service.createAsyncLog({
            actorId: 'admin-1',
            actorName: 'Admin Majba',
            actorEmail: 'majba@test.com',
            actorRole: 'admin',
            module: AuditModule.PRODUCT,
            action: AuditAction.PRODUCT_CREATED,
            route: '/api/v1/products',
            httpMethod: 'POST',
            changes: {
                type: 'MUTATION',
                summary: 'Created product',
                payload: { name: 'T-Shirt', password: 'secretpassword123' }
            }
        });

        expect(repositoryMock.save).toHaveBeenCalled();
        expect(repositoryMock.create).toHaveBeenCalledWith(
            expect.objectContaining({
                module: AuditModule.PRODUCT,
                changes: expect.objectContaining({
                    payload: expect.objectContaining({
                        name: 'T-Shirt',
                        password: '[REDACTED]'
                    })
                })
            })
        );
        expect(result).toBeDefined();
    });

    it('retrieves aggregated stats for admin audit dashboard', async () => {
        const stats = await service.getStats();

        expect(stats.statusCode).toBe(200);
        expect(stats.data?.total).toBe(100);
        expect(stats.data?.moduleStats.length).toBeGreaterThan(0);
    });

    it('interceptor automatically intercepts admin mutations and logs activity', (done) => {
        const mockRequest: any = {
            method: 'PATCH',
            originalUrl: '/api/v1/orders/ORD-999/status',
            url: '/api/v1/orders/ORD-999/status',
            headers: { 'user-agent': 'Chrome/Mac', 'x-real-ip': '192.168.1.1' },
            user: { id: 'admin-uuid', name: 'SuperAdmin', email: 'admin@fashiontime.com', role: 'admin' },
            params: { id: 'ORD-999' },
            body: { newStatus: 'Shipped' }
        };

        const mockResponse: any = { statusCode: 200 };
        const executionContext: any = {
            switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => mockResponse
            })
        };

        const callHandler: any = {
            handle: () => of({ success: true, data: { orderId: 'ORD-999', status: 'Shipped' } })
        };

        const createAsyncLogSpy = jest.spyOn(service, 'createAsyncLog');

        interceptor.intercept(executionContext, callHandler).subscribe({
            next: (val) => {
                expect(val.success).toBe(true);
                expect(createAsyncLogSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        actorEmail: 'admin@fashiontime.com',
                        module: AuditModule.ORDER,
                        action: AuditAction.ORDER_STATUS_UPDATED,
                        httpMethod: 'PATCH'
                    })
                );
                done();
            }
        });
    });

    it('interceptor ignores non-admin and read-only GET requests', (done) => {
        const mockRequest: any = {
            method: 'GET',
            originalUrl: '/api/v1/products',
            headers: {},
            user: { role: 'customer' }
        };

        const executionContext: any = {
            switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => ({})
            })
        };

        const callHandler: any = {
            handle: () => of({ data: [] })
        };

        const createAsyncLogSpy = jest.spyOn(service, 'createAsyncLog');

        interceptor.intercept(executionContext, callHandler).subscribe({
            next: () => {
                expect(createAsyncLogSpy).not.toHaveBeenCalled();
                done();
            }
        });
    });
});
