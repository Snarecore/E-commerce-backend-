import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { ProductComment } from './entities/product-comment.entity';

@Injectable()
export class ProductCommentRepository extends AbstractRepository<ProductComment> {
    constructor(dataSource: DataSource) {
        super(dataSource, ProductComment);
    }

    async findLimitedReplies(parentIds: string[], limitPerParent: number) {
        if (!parentIds?.length) return [];

        const placeholders = parentIds.map(() => '?').join(', ');
        const sql = `
            SELECT * FROM (
                SELECT c.*,
                    ROW_NUMBER() OVER (PARTITION BY c.\`parentId\` ORDER BY c.\`createdAt\` ASC) AS rn
                FROM \`product_comments\` c
                WHERE c.\`parentId\` IN (${placeholders}) AND c.\`isDeleted\` = 0
            ) s
            WHERE s.rn <= ?
            ORDER BY s.\`parentId\`, s.\`createdAt\` ASC
        `;

        const rows = await this.repository.query(sql, [...parentIds, limitPerParent]);
        return rows as ProductComment[];
    }

    async countByParentIds(parentIds: string[]) {
        if (!parentIds || parentIds.length === 0) {
            return new Map<string, number>();
        }

        const rows = await this.repository
            .createQueryBuilder('c')
            .select('c.parentId', 'parentId')
            .addSelect('COUNT(*)', 'cnt')
            .where('c.parentId IN (:...ids)', { ids: parentIds })
            .andWhere('c.isDeleted = :deleted', { deleted: false })
            .groupBy('c.parentId')
            .getRawMany<{ parentId: string; cnt: string }>();

        return new Map(rows.map(r => [r.parentId, Number(r.cnt)]));
    }
}
