import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { isDuplicateKeyError } from '../../utils/db-errors.util';
import { UniqueCodeGeneratorRepository } from './unique-code-generator.repository';

const MAX_ATTEMPTS = 10;

/**
 * Issues product codes (SKUs) and human order numbers.
 *
 * Each code is reserved by inserting it into the registry table, whose columns are UNIQUE: the
 * insert itself is the atomic claim, so two concurrent requests can never receive the same code
 * (a check-then-insert would let both pass). On the rare collision we simply draw again.
 */
@Injectable()
export class UniqueCodeGeneratorService {
    constructor(private readonly repository: UniqueCodeGeneratorRepository) {}

    /** Uniformly random digits from a cryptographic source. */
    private randomDigits(length: number): string {
        let result = '';
        for (let i = 0; i < length; i++) result += randomInt(0, 10).toString();
        return result;
    }

    private async reserve(column: 'productCode' | 'orderId', generate: () => string): Promise<string> {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const code = generate();
            try {
                await this.repository.create({ [column]: code });
                return code;
            } catch (error) {
                if (!isDuplicateKeyError(error)) throw error;
            }
        }
        throw new InternalServerErrorException(`Could not allocate a unique ${column} after ${MAX_ATTEMPTS} attempts.`);
    }

    async getUniqueProductCode(length = 8): Promise<string> {
        return this.reserve('productCode', () => this.randomDigits(length));
    }

    async getUniqueOrderId(length = 6): Promise<string> {
        return this.reserve('orderId', () => `BB${this.randomDigits(length)}`);
    }
}
