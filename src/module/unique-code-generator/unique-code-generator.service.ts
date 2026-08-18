import { Injectable } from '@nestjs/common';
import { UniqueCodeGeneratorRepository } from './unique-code-generator.repository';

@Injectable()
export class UniqueCodeGeneratorService {
	constructor(
		private readonly repository: UniqueCodeGeneratorRepository
	) { }

    private generateRandomCode(length: number): string {
        const characters = '0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

	async getUniqueProductCode(length: number = 8): Promise<string> {
        let uniqueProductCode: string = '';
        let isUnique = false;
        while (!isUnique) {
            uniqueProductCode = this.generateRandomCode(length);
            const existingUPC = await this.repository.findOneByQuery({ productCode: uniqueProductCode });
            if (!existingUPC) {
                isUnique = true;
                await this.repository.create({ productCode: uniqueProductCode });
            }
        }
        return uniqueProductCode;
    }

    async getUniqueOrderId(length: number = 6): Promise<string> {
        let uniqueOrderId: string = '';
        let isUnique = false;
        while (!isUnique) {
            const randomDigits = this.generateRandomCode(length);
            uniqueOrderId = `BB${randomDigits}`;
            const existingOrderId = await this.repository.findOneByQuery({ orderId: uniqueOrderId });
            if (!existingOrderId) {
                isUnique = true;
                await this.repository.create({ orderId: uniqueOrderId });
            }
        }
        return uniqueOrderId;
    }
}
