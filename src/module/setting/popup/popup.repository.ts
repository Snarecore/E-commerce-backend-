import { Injectable, OnModuleInit } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { Popup } from './entities/popup.entity';

@Injectable()
export class PopupRepository extends AbstractRepository<Popup> implements OnModuleInit {
    constructor(dataSource: DataSource) {
        super(dataSource, Popup);
    }

    async onModuleInit() {
        try {
            await this.repository.query(`
                CREATE TABLE IF NOT EXISTS \`popup\` (
                    \`id\` varchar(255) NOT NULL,
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint(1) NOT NULL DEFAULT 0,
                    \`isActive\` tinyint(1) NOT NULL DEFAULT 1,
                    \`priority\` int NOT NULL DEFAULT 0,
                    \`title\` varchar(255) DEFAULT NULL,
                    \`description\` text DEFAULT NULL,
                    \`image\` varchar(500) NOT NULL,
                    \`link\` varchar(500) DEFAULT NULL,
                    \`startDate\` datetime DEFAULT NULL,
                    \`endDate\` datetime DEFAULT NULL,
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        } catch (e) {
            console.error('Error auto-creating popup table:', e);
        }
    }

    async getActivePopup(): Promise<Popup | null> {
        const now = new Date();
        return this.repository
            .createQueryBuilder('popup')
            .where('popup.isDeleted = :isDeleted', { isDeleted: false })
            .andWhere('popup.isActive = :isActive', { isActive: true })
            .andWhere('(popup.startDate IS NULL OR popup.startDate <= :now)', { now })
            .andWhere('(popup.endDate IS NULL OR popup.endDate >= :now)', { now })
            .orderBy('popup.priority', 'DESC')
            .addOrderBy('popup.createdAt', 'DESC')
            .getOne();
    }
}
