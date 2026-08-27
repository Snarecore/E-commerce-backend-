import { BadRequestException } from '@nestjs/common';
import { MegaDiscountService } from './mega-discount.service';
import { MegaDiscountRepository } from './mega-discount.repository';

describe('MegaDiscountService', () => {
	let service: MegaDiscountService;
	let repository: Partial<MegaDiscountRepository>;

	beforeEach(() => {
		repository = {
			getSingleton: jest.fn().mockResolvedValue({
				id: '1',
				isActive: false,
				discountPercentage: 0,
				menuText: 'Mega Sale'
			}),
			updateSingleton: jest.fn().mockImplementation((data) =>
				Promise.resolve({
					id: '1',
					...data
				})
			)
		};
		service = new MegaDiscountService(repository as MegaDiscountRepository);
	});

	it('should return mega discount singleton configuration', async () => {
		const result = await service.getMegaDiscount();
		expect(result.data?.isActive).toBe(false);
		expect(result.data?.discountPercentage).toBe(0);
		expect(result.data?.menuText).toBe('Mega Sale');
	});

	it('should update mega discount configuration when valid', async () => {
		const dto = {
			isActive: true,
			discountPercentage: 20,
			menuText: 'Mega Sale 20% Off'
		};
		const result = await service.updateMegaDiscount(dto);
		expect(result.data?.isActive).toBe(true);
		expect(result.data?.discountPercentage).toBe(20);
		expect(result.data?.menuText).toBe('Mega Sale 20% Off');
	});

	it('should throw BadRequestException if isActive is true but discountPercentage is 0', async () => {
		const dto = {
			isActive: true,
			discountPercentage: 0,
			menuText: 'Mega Sale'
		};
		await expect(service.updateMegaDiscount(dto)).rejects.toThrow(BadRequestException);
	});

	it('should throw BadRequestException if isActive is true but menuText is empty', async () => {
		const dto = {
			isActive: true,
			discountPercentage: 20,
			menuText: '   '
		};
		await expect(service.updateMegaDiscount(dto)).rejects.toThrow(BadRequestException);
	});
});
