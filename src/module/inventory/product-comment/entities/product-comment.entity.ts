import {
    Entity, Column, ManyToOne, OneToMany, JoinColumn, Index
} from 'typeorm';
import { AbstractEntity } from '../../../../database/abstract.entity';
import { User } from '../../../user/entities/user.entity';
import { Product } from '../../product/entities/product.entity';

@Entity('product_comments')
@Index(['productId', 'createdAt'])
@Index(['parentId', 'createdAt'])
export class ProductComment extends AbstractEntity {
    @Column({ type: 'char', length: 36 })
    productId: string;

    @ManyToOne(() => Product, p => p.comments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'productId' })
    product?: Product;

    @Column({ type: 'char', length: 36, nullable: true })
    userId: string | null;

    @ManyToOne(() => User, u => u.productComments, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'userId' })
    user?: User | null;

    @Column({ type: 'char', length: 36, nullable: true })
    parentId?: string | null;

    @ManyToOne(() => ProductComment, c => c.children, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'parentId' })
    parent?: ProductComment | null;

    @OneToMany(() => ProductComment, c => c.parent)
    children?: ProductComment[];

    @Column({ type: 'text' })
    body: string;
}
