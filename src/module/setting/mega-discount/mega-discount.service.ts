import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ResponseUtils } from '../../../utils/response.utils';
import { UpdateMegaDiscountDto } from './dto/update-mega-discount.dto';
import { MegaDiscountRepository } from './mega-discount.repository';

@Injectable()
export class MegaDiscountService {
	constructor(private readonly megaDiscountRepository: MegaDiscountRepository) {}

	async getMegaDiscount() {
		try {
			const record = await this.megaDiscountRepository.getSingleton();
			const data = {
				id: record.id,
				isActive: record.isActive,
				discountPercentage: Number(record.discountPercentage || 0),
				menuText: record.menuText || 'Mega Sale'
			};
			return ResponseUtils.successResponseHandler(200, 'Mega discount configuration fetched successfully', 'data', data);
		} catch (error: any) {
			throw new InternalServerErrorException(error.message || 'Error fetching mega discount configuration');
		}
	}

	async updateMegaDiscount(dto: UpdateMegaDiscountDto) {
		try {
			if (dto.isActive) {
				if (dto.discountPercentage <= 0) {
					throw new BadRequestException('Discount percentage must be greater than 0 when mega discount is active');
				}
				if (!dto.menuText || dto.menuText.trim().length === 0) {
					throw new BadRequestException('Menu text must not be empty when mega discount is active');
				}
			}

			const updated = await this.megaDiscountRepository.updateSingleton({
				isActive: dto.isActive,
				discountPercentage: dto.discountPercentage,
				menuText: dto.menuText.trim()
			});

			const data = {
				id: updated.id,
				isActive: updated.isActive,
				discountPercentage: Number(updated.discountPercentage || 0),
				menuText: updated.menuText
			};

			return ResponseUtils.successResponseHandler(200, 'Mega discount configuration updated successfully', 'data', data);
		} catch (error: any) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new InternalServerErrorException(error.message || 'Error updating mega discount configuration');
		}
	}
}
