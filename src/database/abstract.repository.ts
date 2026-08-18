import { Injectable } from '@nestjs/common';
import {
    Repository,
    EntityTarget,
    DataSource,
    DeepPartial,
    FindOptionsWhere,
    DeleteResult,
    FindOneOptions,
    FindOptionsOrder,
    In
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

interface BaseEntity {
    isDeleted: boolean;
}

interface PaginationParams<T> {
    page: number;
    limit: number;
    query?: FindOptionsWhere<T>;
    order?: FindOptionsOrder<T>;
    relations?: string[];
}

interface PaginationWithHardLimitParams<T> {
    page: number;
    limit: number;
    maxTotal: number;
    query?: FindOptionsWhere<T>;
    order?: FindOptionsOrder<T>;
    relations?: string[];
}

interface IRepository<T extends BaseEntity> {
    create(data: DeepPartial<T>): Promise<T>;
    createMany(data: DeepPartial<T>[]): Promise<T[]>;
    findAll(query?: FindOptionsWhere<T>): Promise<T[]>;
    paginate(options: PaginationParams<T>): Promise<{ data: T[]; total: number; page: number; limit: number, pageCount: number }>;
    findOne(id: string | number): Promise<T | null>;
    findOneByQuery(query?: FindOptionsWhere<T>): Promise<T | null>;
    findOneByQueryRelation(query?: FindOptionsWhere<T>, arg?: FindOneOptions<T>): Promise<T | null>;
    update(id: string | number, data: QueryDeepPartialEntity<T>): Promise<T | null>;
    delete(id: string | number): Promise<DeleteResult>;
    softDelete(id: string | number): Promise<T | null>;
    restore(id: string | number): Promise<T | null>;
    count(query?: FindOptionsWhere<T>): Promise<number>;
    exists(id: string | number): Promise<boolean>;
    findBySlug(slug: string): Promise<T | null>;
    deleteByQuery(query: FindOptionsWhere<T>): Promise<void>;
}

@Injectable()
export abstract class AbstractRepository<T extends BaseEntity> implements IRepository<T> {
    protected repository: Repository<T>;

    constructor(
        private readonly dataSource: DataSource,
        private readonly entity: EntityTarget<T>
    ) {
        this.repository = this.dataSource.getRepository(this.entity);
    }

    private isDeletedCondition(query?: FindOptionsWhere<T>): FindOptionsWhere<T> {
        return { ...query, isDeleted: false } as FindOptionsWhere<T>;
    }

    async create(data: DeepPartial<T>): Promise<T> {
        const entity = this.repository.create(data);
        return this.repository.save(entity);
    }

    async createMany(data: DeepPartial<T>[]): Promise<T[]> {
        const entities = this.repository.create(data);
        return this.repository.save(entities);
    }

    async findAll(query?: FindOptionsWhere<T>): Promise<T[]> {
        return this.repository.find({ where: this.isDeletedCondition(query) });
    }

    async findAllWithOrder(query?: FindOptionsWhere<T>, order?: FindOptionsOrder<T>): Promise<T[]> {
        return this.repository.find({ where: this.isDeletedCondition(query), order });
    }

    async findByQueryWithHardLimit(query?: FindOptionsWhere<T>, maxTotal = 10, relations: string[] = [], order?: FindOptionsOrder<T>): Promise<T[]> {
        return this.repository.find({
            where: this.isDeletedCondition(query),
            take: maxTotal,
            relations,
            order
        });
    }

    async paginate({
        page = 1,
        limit = 10,
        query,
        order,
        relations = []
    }: PaginationParams<T>): Promise<{
        data: T[];
        total: number;
        page: number;
        limit: number;
        pageCount: number;
    }> {
        const [data, total] = await this.repository.findAndCount({
            where: this.isDeletedCondition(query),
            skip: (page - 1) * limit,
            take: limit,
            order,
            relations
        });
        const pageCount = Math.ceil(total / limit);
        return { data, total, page, limit, pageCount };
    }

    async paginateWithHardLimit({
        page = 1,
        limit = 10,
        maxTotal = 50,
        query,
        order,
        relations = []
    }: PaginationWithHardLimitParams<T>): Promise<{
        data: T[];
        total: number;
        page: number;
        limit: number;
        pageCount: number;
    }> {
        const [data, actualTotal] = await this.repository.findAndCount({
            where: this.isDeletedCondition(query),
            skip: (page - 1) * limit,
            take: limit,
            order,
            relations
        });

        const total = Math.min(actualTotal, maxTotal);
        const pageCount = Math.ceil(total / limit);

        return { data, total, page, limit, pageCount };
    }

    async findOne(id: string | number): Promise<T | null> {
        return this.repository.findOne({
            where: this.isDeletedCondition({ id } as unknown as FindOptionsWhere<T>)
        });
    }

    async findOneByQuery(query?: FindOptionsWhere<T>): Promise<T | null> {
        return this.repository.findOne({
            where: this.isDeletedCondition(query)
        });
    }

    async findOneByQueryIncludingDeleted(
        query: FindOptionsWhere<T>
    ): Promise<T | null> {
        return this.repository.findOne({ where: query });
    }

    async findOneByQueryRelation(
        query?: FindOptionsWhere<T>,
        arg: FindOneOptions<T> = {}
    ): Promise<T | null> {
        return this.repository.findOne({
            where: this.isDeletedCondition(query),
            ...arg
        });
    }

    async update(id: string | number, data: QueryDeepPartialEntity<T>): Promise<T | null> {
        await this.repository.update(id, data);
        return this.findOne(id);
    }

    async delete(id: string | number): Promise<DeleteResult> {
        return await this.repository.delete(id);
    }

    async softDelete(id: string | number): Promise<T | null> {
        const entity = await this.findOne(id);
        if (!entity) return null;

        entity.isDeleted = true;
        await this.repository.save(entity);
        return entity;
    }

    async restore(id: string | number): Promise<T | null> {
        const entity = await this.findOne(id);
        if (!entity) return null;

        entity.isDeleted = false;
        await this.repository.save(entity);
        return entity;
    }

    async count(query?: FindOptionsWhere<T>): Promise<number> {
        return this.repository.count({ where: this.isDeletedCondition(query) });
    }

    async exists(id: string | number): Promise<boolean> {
        const entity = await this.findOne(id);
        return !!entity;
    }

    async findBySlug(slug: string): Promise<T | null> {
        return this.repository.findOne({
            where: this.isDeletedCondition({ slug } as unknown as FindOptionsWhere<T>)
        });
    }

    async deleteByQuery(query: FindOptionsWhere<T>): Promise<void> {
        await this.repository.delete(query);
    }

    async findOneWithRelations(
        id: string,
        relations: string[] = []
    ): Promise<T | null> {
        return this.repository.findOne({
            where: this.isDeletedCondition({ id } as unknown as FindOptionsWhere<T>),
            relations
        });
    }

    async findByIds(ids: string[]): Promise<T[]> {
        return this.repository.find({
            where: {
                id: In(ids),
                isDeleted: false
            } as unknown as FindOptionsWhere<T>
        });
    }

    async save(entity: DeepPartial<T> | DeepPartial<T>[]): Promise<T | T[]> {
        if (Array.isArray(entity)) {
            return this.repository.save(entity);
        }
        return this.repository.save(entity);
    }

    async findAllWithRelations(
        query?: FindOptionsWhere<T>,
        relations: string[] = []
    ): Promise<T[]> {
        return this.repository.find({
            where: this.isDeletedCondition(query),
            relations
        });
    }
}
