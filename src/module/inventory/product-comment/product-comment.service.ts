import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ProductComment } from './entities/product-comment.entity';
import { UserRepository } from 'src/module/user/user.repository';
import { UserProfileRepository } from 'src/module/user-profile/user-profile.repository';
import { In } from 'typeorm';
import { CreateProductCommentDto } from './dto/create-product-comment.dto';
import { UpdateProductCommentDto } from './dto/update-product-comment.dto';
import { CommentFilterDto } from './dto/comment-filter.dto';
import { ProductCommentRepository } from './product-comment.repository';
import { ApiResponse, ResponseUtils } from 'src/utils/response.utils';
import { toSafeUser } from 'src/utils/safe-user.utils';
import { ProductRepository } from '../product/product.repository';
import { CommentNode } from './types/comment-node.type';
import { IsNull } from 'typeorm';
import { Product } from '../product/entities/product.entity';

type ProductLite = {
    id: string;
    name: string;
    featuredImage: string | null;
};

@Injectable()
export class ProductCommentService {
    constructor(
        private readonly repo: ProductCommentRepository,
        private readonly productRepo: ProductRepository,
        private readonly userRepo: UserRepository,
        private readonly profileRepo: UserProfileRepository
    ) { }

    async create(dto: CreateProductCommentDto, user: any) {
        const product = await this.productRepo.findOne(dto.productId);
        if (!product) throw new HttpException('Product not found', HttpStatus.NOT_FOUND);

        if (dto.parentId) {
            const parent = await this.repo.findOne(dto.parentId);
            if (!parent || parent.productId !== dto.productId || parent.isDeleted) {
                throw new HttpException('Invalid parent comment', HttpStatus.BAD_REQUEST);
            }
        }

        const saved = await this.repo.create({
            productId: dto.productId,
            parentId: dto.parentId ?? null,
            userId: user.id,
            body: dto.body
        }) as ProductComment;

        return ResponseUtils.successResponseHandler(201, 'Comment posted.', 'data', {
            id: saved.id,
            body: saved.body,
            createdAt: saved.createdAt,
            user: null,
            replies: [],
            replyCount: 0
        });
    }

    async listForProduct(
        productId: string,
        dto: CommentFilterDto
    ): Promise<ApiResponse<{ data: CommentNode[]; total: number; page: number; limit: number; pageCount: number }>> {
        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 50) : 10;
        const replyLimit = dto.replyLimit && dto.replyLimit > 0 ? Math.min(dto.replyLimit, 20) : 3;

        const { data: tops, total, pageCount } = await this.repo.paginate({
            page,
            limit,
            query: { productId, parentId: IsNull() },
            order: { createdAt: 'desc' }
        });

        const topIds = tops.map(t => t.id);

        const replies = topIds.length
            ? await this.repo.findLimitedReplies(topIds, replyLimit)
            : [];

        const replyCounts = topIds.length
            ? await this.repo.countByParentIds(topIds)
            : new Map<string, number>();

        const userIds = Array.from(new Set(
            [...tops, ...replies].map(c => c.userId).filter(Boolean)
        ));
        const [users, profiles] = await Promise.all([
            userIds.length ? this.userRepo.findAll({ id: In(userIds) } as any) : Promise.resolve([]),
            userIds.length ? this.profileRepo.findAllWithRelations({ user: { id: In(userIds) } } as any, ['user']) : Promise.resolve([])
        ]);
        const userMap = new Map(users.map(u => [u.id, toSafeUser(u)]));
        const profileMap = (profiles ?? []).reduce(
            (m, p) => {
                const id = p.user?.id;
                if (id) m.set(id, p.profileImage ?? null);
                return m;
            },
            new Map<string, string | null>()
        );

        const byParent = replies.reduce((m, r) => {
            const arr = m.get(r.parentId!) ?? [];
            arr.push(r);
            m.set(r.parentId!, arr);
            return m;
        }, new Map<string, ProductComment[]>());

        const toISO = (d: any): string =>
            d && typeof d.toISOString === 'function' ? d.toISOString() : String(d);

        const buildUser = (uid: string | null | undefined) => {
            if (!uid) return null;
            const base = userMap.get(uid);
            return base ? { ...base, profileImage: profileMap.get(uid) ?? null } : null;
        };

        const nodes: CommentNode[] = tops.map(t => ({
            id: t.id,
            body: t.body,
            createdAt: toISO(t.createdAt),
            user: buildUser(t.userId),
            replies: (byParent.get(t.id) ?? []).map(r => ({
                id: r.id,
                body: r.body,
                createdAt: toISO(r.createdAt),
                user: buildUser(r.userId),
                replies: [],
                replyCount: 0
            })),
            replyCount: replyCounts.get(t.id) ?? 0
        }));

        return ResponseUtils.successResponseHandler(200, 'Comments fetched.', 'data', {
            data: nodes,
            total,
            page,
            limit,
            pageCount
        });
    }

    async findAll(
        dto: CommentFilterDto
    ): Promise<ApiResponse<{ data: CommentNode[]; total: number; page: number; limit: number; pageCount: number }>> {
        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 50) : 10;
        const replyLimit = dto.replyLimit && dto.replyLimit > 0 ? Math.min(dto.replyLimit, 20) : 3;

        const { data: tops, total, pageCount } = await this.repo.paginate({
            page,
            limit,
            query: { parentId: IsNull() },
            order: { createdAt: 'desc' },
            relations: ['product']
        });

        const topIds = tops.map(t => t.id);

        const replies = topIds.length
            ? await this.repo.findLimitedReplies(topIds, replyLimit)
            : [];

        const replyCounts = topIds.length
            ? await this.repo.countByParentIds(topIds)
            : new Map<string, number>();

        const userIds = Array.from(new Set(
            [...tops, ...replies].map(c => c.userId).filter(Boolean)
        ));
        const [users, profiles] = await Promise.all([
            userIds.length ? this.userRepo.findAll({ id: In(userIds) } as any) : Promise.resolve([]),
            userIds.length ? this.profileRepo.findAllWithRelations({ user: { id: In(userIds) } } as any, ['user']) : Promise.resolve([])
        ]);
        const userMap = new Map(users.map(u => [u.id, toSafeUser(u)]));
        const profileMap = (profiles ?? []).reduce(
            (m, p) => {
                const id = p.user?.id;
                if (id) m.set(id, p.profileImage ?? null);
                return m;
            },
            new Map<string, string | null>()
        );

        const byParent = replies.reduce((m, r) => {
            const arr = m.get(r.parentId!) ?? [];
            arr.push(r);
            m.set(r.parentId!, arr);
            return m;
        }, new Map<string, ProductComment[]>());

        const toISO = (d: any): string =>
            d && typeof d.toISOString === 'function' ? d.toISOString() : String(d);

        const buildUser = (uid: string | null | undefined) => {
            if (!uid) return null;
            const base = userMap.get(uid);
            return base ? { ...base, profileImage: profileMap.get(uid) ?? null } : null;
        };

        const buildProduct = (p?: Product | null): ProductLite | null => {
            if (!p) return null;
            return {
                id: p.id,
                name: p.name,
                featuredImage: p.featuredImage ?? null
            };
        };

        const nodes: CommentNode[] = tops.map(t => ({
            id: t.id,
            body: t.body,
            createdAt: toISO(t.createdAt),
            user: buildUser(t.userId),
            product: buildProduct((t as any).product), 
            replies: (byParent.get(t.id) ?? []).map(r => ({
                id: r.id,
                body: r.body,
                createdAt: toISO(r.createdAt),
                user: buildUser(r.userId),
                replies: [],
                replyCount: 0
            })),
            replyCount: replyCounts.get(t.id) ?? 0
        }));

        return ResponseUtils.successResponseHandler(200, 'Comments fetched.', 'data', {
            data: nodes,
            total,
            page,
            limit,
            pageCount
        });
    }

    async update(commentId: string, dto: UpdateProductCommentDto, user: any) {
        const c = await this.repo.findOne(commentId);
        if (!c || c.isDeleted) throw new HttpException('Comment not found', HttpStatus.NOT_FOUND);
        if (c.userId !== user.id) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

        const updated = await this.repo.update(c.id, { body: dto.body }) as ProductComment;
        return ResponseUtils.successResponseHandler(200, 'Comment updated.', 'data', {
            id: updated.id,
            body: updated.body,
            createdAt: updated.createdAt
        });
    }

    async remove(commentId: string) {
        const c = await this.repo.findOne(commentId);
        if (!c) throw new HttpException('Comment not found', HttpStatus.NOT_FOUND);

        await this.repo.update(c.id, { isDeleted: true });

        return ResponseUtils.deleteResponseHandler(200, 'Comment deleted.', true);
    }
}
