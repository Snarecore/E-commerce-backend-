import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryEngineService } from './inventory-engine.service';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockAdjustment } from '../entities/stock-adjustment.entity';
import { StockAdjustmentItem } from '../entities/stock-adjustment-item.entity';
import { Product } from '../../inventory/product/entities/product.entity';
import { Orders } from '../../order/entity/order.entity';
import { OrderSummary } from '../../order-summary/entity/order-summary.entity';
import { InventoryOutboxService } from './inventory-outbox.service';
import { StockMovementType, StockReferenceType } from '../../../enums/stock-movement.enum';
import { AdjustmentStatus, AdjustmentReason, AdjustmentMode } from '../../../enums/stock-adjustment.enum';
import { HttpException } from '@nestjs/common';

describe('InventoryEngineService', () => {
    let service: InventoryEngineService;
    let stockMovementRepo: jest.Mocked<Repository<StockMovement>>;
    let stockAdjustmentRepo: jest.Mocked<Repository<StockAdjustment>>;
    let stockAdjustmentItemRepo: jest.Mocked<Repository<StockAdjustmentItem>>;
    let productRepo: jest.Mocked<Repository<Product>>;
    let dataSource: jest.Mocked<DataSource>;

    const mockProduct: Partial<Product> = {
        id: 'prod-uuid-1',
        name: 'Classic Oxford Shirt',
        sku: 'OX-BLU-M',
        quantity: 20,
        sizeStock: { S: 5, M: 10, L: 5 }
    };

    beforeEach(async () => {
        const mockStockMovementRepo = {
            create: jest.fn().mockImplementation((dto) => ({ id: 'movement-uuid-1', ...dto })),
            save: jest.fn().mockImplementation(async (item) => ({ id: item.id || 'movement-uuid-1', ...item })),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn()
        };

        const mockStockAdjustmentRepo = {
            create: jest.fn().mockImplementation((dto) => ({ id: 'adj-uuid-1', ...dto })),
            save: jest.fn().mockImplementation(async (item) => ({ id: item.id || 'adj-uuid-1', ...item })),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn()
        };

        const mockStockAdjustmentItemRepo = {
            create: jest.fn().mockImplementation((dto) => ({ id: 'adj-item-uuid-1', ...dto })),
            save: jest.fn().mockImplementation(async (item) => ({ id: item.id || 'adj-item-uuid-1', ...item }))
        };

        const mockProductRepo = {
            findOne: jest.fn(),
            update: jest.fn()
        };

        const mockQueryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            manager: {
                findOne: jest.fn(),
                update: jest.fn(),
                create: jest.fn().mockImplementation((entityClass, dto) => ({ id: 'gen-uuid', ...dto })),
                save: jest.fn().mockImplementation(async (item) => item),
                getRepository: jest.fn().mockReturnValue(mockStockMovementRepo)
            }
        };

        const mockDataSource = {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner)
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InventoryEngineService,
                {
                    provide: getRepositoryToken(StockMovement),
                    useValue: mockStockMovementRepo
                },
                {
                    provide: getRepositoryToken(StockAdjustment),
                    useValue: mockStockAdjustmentRepo
                },
                {
                    provide: getRepositoryToken(StockAdjustmentItem),
                    useValue: mockStockAdjustmentItemRepo
                },
                {
                    provide: getRepositoryToken(Product),
                    useValue: mockProductRepo
                },
                {
                    provide: getRepositoryToken(Orders),
                    useValue: { findOne: jest.fn(), save: jest.fn() }
                },
                {
                    provide: getRepositoryToken(OrderSummary),
                    useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() }
                },
                {
                    provide: InventoryOutboxService,
                    useValue: {
                        enqueueEvent: jest.fn().mockResolvedValue({ id: 'outbox-uuid' }),
                        processOutbox: jest.fn().mockResolvedValue(undefined)
                    }
                },
                {
                    provide: DataSource,
                    useValue: mockDataSource
                }
            ]
        }).compile();

        service = module.get<InventoryEngineService>(InventoryEngineService);
        stockMovementRepo = module.get(getRepositoryToken(StockMovement));
        stockAdjustmentRepo = module.get(getRepositoryToken(StockAdjustment));
        stockAdjustmentItemRepo = module.get(getRepositoryToken(StockAdjustmentItem));
        productRepo = module.get(getRepositoryToken(Product));
        dataSource = module.get(DataSource);
    });

    describe('recordMovement', () => {
        it('should append an immutable ledger entry', async () => {
            const movement = await service.recordMovement({
                productId: 'prod-uuid-1',
                movementType: StockMovementType.OPENING,
                quantityChange: 20,
                onHandBefore: 0,
                onHandAfter: 20,
                referenceType: StockReferenceType.OPENING,
                referenceId: 'INIT-001'
            });

            expect(stockMovementRepo.create).toHaveBeenCalled();
            expect(stockMovementRepo.save).toHaveBeenCalled();
            expect(movement.quantityChange).toBe(20);
            expect(movement.onHandAfter).toBe(20);
        });

        it('should enforce idempotency when idempotencyKey is provided', async () => {
            const existingMovement = {
                id: 'existing-id',
                idempotencyKey: 'IDEMP-123',
                productId: 'prod-uuid-1',
                quantityChange: 5
            } as StockMovement;

            stockMovementRepo.findOne.mockResolvedValueOnce(existingMovement);

            const result = await service.recordMovement({
                productId: 'prod-uuid-1',
                movementType: StockMovementType.ADJUSTMENT_ADDITION,
                quantityChange: 5,
                onHandBefore: 10,
                onHandAfter: 15,
                referenceType: StockReferenceType.STOCK_ADJUSTMENT,
                idempotencyKey: 'IDEMP-123'
            });

            expect(stockMovementRepo.findOne).toHaveBeenCalledWith({ where: { idempotencyKey: 'IDEMP-123' } });
            expect(stockMovementRepo.save).not.toHaveBeenCalled();
            expect(result.id).toBe('existing-id');
        });
    });

    describe('adjustStock', () => {
        it('should atomically adjust total quantity and sizeStock with movement ledger entry', async () => {
            const queryRunner = dataSource.createQueryRunner();
            (queryRunner.manager.findOne as jest.Mock).mockResolvedValueOnce({
                ...mockProduct,
                sizeStock: { S: 5, M: 10, L: 5 }
            });

            const result = await service.adjustStock({
                productId: 'prod-uuid-1',
                size: 'M',
                quantityChange: -3,
                movementType: StockMovementType.ADJUSTMENT_DAMAGE,
                referenceType: StockReferenceType.STOCK_ADJUSTMENT,
                referenceId: 'ADJ-001',
                reason: 'Water damaged in warehouse'
            });

            expect(queryRunner.manager.findOne).toHaveBeenCalledWith(
                Product,
                expect.objectContaining({
                    where: { id: 'prod-uuid-1', isDeleted: false },
                    lock: { mode: 'pessimistic_write' }
                })
            );

            expect(queryRunner.manager.update).toHaveBeenCalledWith(
                Product,
                'prod-uuid-1',
                {
                    quantity: 17,
                    sizeStock: { S: 5, M: 7, L: 5 }
                }
            );

            expect(result.product.quantity).toBe(17);
            expect(result.product.sizeStock?.M).toBe(7);
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should reject adjustment if negative stock would result and allowNegativeStock is false', async () => {
            const queryRunner = dataSource.createQueryRunner();
            (queryRunner.manager.findOne as jest.Mock).mockResolvedValueOnce({
                ...mockProduct,
                quantity: 5,
                sizeStock: { M: 5 }
            });

            await expect(
                service.adjustStock({
                    productId: 'prod-uuid-1',
                    size: 'M',
                    quantityChange: -10,
                    movementType: StockMovementType.ADJUSTMENT_DAMAGE,
                    referenceType: StockReferenceType.STOCK_ADJUSTMENT
                })
            ).rejects.toThrow(HttpException);

            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        });
    });

    describe('createAdjustment', () => {
        it('should create an adjustment draft with item calculation', async () => {
            const queryRunner = dataSource.createQueryRunner();
            (queryRunner.manager.findOne as jest.Mock).mockResolvedValueOnce({
                ...mockProduct,
                sizeStock: { S: 5, M: 10, L: 5 }
            });

            const adj = await service.createAdjustment({
                reason: AdjustmentReason.DAMAGED,
                mode: AdjustmentMode.SUBTRACTION,
                notes: 'Damaged item batch',
                items: [
                    { productId: 'prod-uuid-1', size: 'M', quantity: 2, unitCost: 100 }
                ]
            }, { id: 'admin-1', name: 'Admin' });

            expect(queryRunner.manager.create).toHaveBeenCalled();
            expect(queryRunner.manager.save).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
            expect(adj.status).toBe(AdjustmentStatus.PENDING_APPROVAL);
            expect(adj.totalItemsAdjusted).toBe(2);
        });
    });

    describe('getAvailability', () => {
        it('should return onHand, reserved and available for total and variant', async () => {
            productRepo.findOne.mockResolvedValueOnce({
                ...mockProduct
            } as Product);

            const result = await service.getAvailability('prod-uuid-1', 'M');

            expect(result.onHand).toBe(10);
            expect(result.available).toBe(10);
            expect(result.reserved).toBe(0);
        });
    });

    describe('executeOrderExchange', () => {
        it('should swap old size for new size atomically and record ledger movements', async () => {
            const queryRunner = dataSource.createQueryRunner();
            const mockOrder = {
                id: 'order-uuid-1',
                orderId: 'ORD-1001',
                status: 'Processing',
                statusHistory: [],
                orderSummaries: [
                    {
                        id: 'item-1',
                        productId: 'prod-uuid-1',
                        productName: 'Classic Oxford Shirt',
                        size: 'M',
                        selectedSize: 'M',
                        quantity: 1,
                        price: 500,
                        unitCostPrice: 300
                    }
                ]
            };

            const mockProd = {
                id: 'prod-uuid-1',
                name: 'Classic Oxford Shirt',
                sku: 'OX-BLU',
                quantity: 20,
                sizeStock: { S: 5, M: 10, L: 5 }
            };

            (queryRunner.manager.findOne as jest.Mock)
                .mockResolvedValueOnce(mockOrder) // for Orders
                .mockResolvedValueOnce(mockProd);  // for Product

            const result = await service.executeOrderExchange({
                orderId: 'ORD-1001',
                productId: 'prod-uuid-1',
                oldSize: 'M',
                newSize: 'L',
                quantity: 1,
                reason: 'Size too small',
                note: 'Customer requested size L'
            }, { id: 'admin-1', name: 'Admin' });

            expect(result.success).toBe(true);
            expect(result.exchangedItem).toEqual({
                oldSize: 'M',
                newSize: 'L',
                quantity: 1
            });
            expect(result.product.sizeStock).toEqual({
                S: 5,
                M: 11, // 10 + 1 returned
                L: 4   // 5 - 1 dispatched
            });
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should reject exchange if order or item has already been exchanged once (1-Time Rule)', async () => {
            const queryRunner = dataSource.createQueryRunner();
            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                status: 'SHIPPED',
                isExchanged: true,
                exchangeCount: 1,
                orderSummaries: [
                    {
                        id: 'sum-1',
                        productId: 'prod-uuid-1',
                        productName: 'T-Shirt',
                        size: 'L',
                        selectedSize: 'L',
                        quantity: 1,
                        isExchanged: true,
                        exchangeCount: 1,
                        originalSize: 'M'
                    }
                ]
            };

            (queryRunner.manager.findOne as jest.Mock).mockResolvedValueOnce(mockOrder);

            await expect(service.executeOrderExchange({
                orderId: 'ORD-1001',
                productId: 'prod-uuid-1',
                oldSize: 'L',
                newSize: 'XL',
                quantity: 1
            }, { id: 'admin-1', name: 'Admin' })).rejects.toThrow(/already used its 1 allowed exchange|already been exchanged once/);

            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        });
    });

    describe('getInventoryAnalyticsSummary', () => {
        it('should aggregate total stock, valuations, and low stock counts', async () => {
            const mockQb = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    totalProducts: '10',
                    totalStockOnHand: '150',
                    totalCostValue: '45000.00',
                    totalRetailValue: '75000.00',
                    outOfStockCount: '1',
                    lowStockCount: '3'
                }),
                getCount: jest.fn().mockResolvedValue(25)
            };

            (productRepo.createQueryBuilder as jest.Mock) = jest.fn().mockReturnValue(mockQb);
            (stockMovementRepo.createQueryBuilder as jest.Mock) = jest.fn().mockReturnValue(mockQb);

            const summary = await service.getInventoryAnalyticsSummary();

            expect(summary.totalProducts).toBe(10);
            expect(summary.totalStockOnHand).toBe(150);
            expect(summary.totalCostValue).toBe(45000);
            expect(summary.totalRetailValue).toBe(75000);
            expect(summary.potentialGrossProfit).toBe(30000);
            expect(summary.lowStockCount).toBe(3);
            expect(summary.outOfStockCount).toBe(1);
            expect(summary.totalMovementsLast30Days).toBe(25);
        });
    });

    describe('getLowStockAlerts', () => {
        it('should return paginated products where stock is low or out of stock', async () => {
            const mockQb = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                addOrderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([
                    [{ id: 'prod-1', name: 'Low Stock Item', quantity: 2, quantityAlert: 5 }],
                    1
                ])
            };

            (productRepo.createQueryBuilder as jest.Mock) = jest.fn().mockReturnValue(mockQb);

            const result = await service.getLowStockAlerts({ page: 1, limit: 10 });

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.data[0].quantity).toBe(2);
        });
    });
});
