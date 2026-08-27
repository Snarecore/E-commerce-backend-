import { Injectable, OnModuleInit } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { MegaDiscount } from './entities/mega-discount.entity';

export const SINGLETON_MEGA_DISCOUNT_ID = '1';

@Injectable()
export class MegaDiscountRepository extends AbstractRepository<MegaDiscount> implements OnModuleInit {
	constructor(dataSource: DataSource) {
		super(dataSource, MegaDiscount);
	}

	async onModuleInit() {
		try {
			await this.repository.query(`
				CREATE TABLE IF NOT EXISTS \`mega_discount\` (
				  \`id\` varchar(255) NOT NULL,
				  \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
				  \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
				  \`isDeleted\` tinyint NOT NULL DEFAULT 0,
				  \`isActive\` tinyint NOT NULL DEFAULT 0,
				  \`discountPercentage\` decimal(5,2) NOT NULL DEFAULT '0.00',
				  \`menuText\` varchar(255) NOT NULL DEFAULT 'Mega Sale',
				  PRIMARY KEY (\`id\`)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
			`);
		} catch (e) {
			console.error('Error auto-creating mega_discount table:', e);
		}
		await this.seedDefaultSingleton();
	}

	async seedDefaultSingleton(): Promise<MegaDiscount> {
		try {
			let record = await this.repository.findOne({ where: { id: SINGLETON_MEGA_DISCOUNT_ID } });
			if (!record) {
				const entity = this.repository.create({
					id: SINGLETON_MEGA_DISCOUNT_ID,
					isActive: false,
					discountPercentage: 0,
					menuText: 'Mega Sale'
				});
				record = await this.repository.save(entity);
			}
			return record;
		} catch (error) {
			return {
				id: SINGLETON_MEGA_DISCOUNT_ID,
				isActive: false,
				discountPercentage: 0,
				menuText: 'Mega Sale',
				createdAt: new Date(),
				updatedAt: new Date(),
				isDeleted: false
			} as MegaDiscount;
		}
	}

	async getSingleton(): Promise<MegaDiscount> {
		const record = await this.repository.findOne({ where: { id: SINGLETON_MEGA_DISCOUNT_ID } });
		if (!record) {
			return this.seedDefaultSingleton();
		}
		return record;
	}

	async updateSingleton(data: { isActive: boolean; discountPercentage: number; menuText: string }): Promise<MegaDiscount> {
		await this.repository.update(SINGLETON_MEGA_DISCOUNT_ID, {
			isActive: data.isActive,
			discountPercentage: data.discountPercentage,
			menuText: data.menuText
		});
		return this.getSingleton();
	}
}
