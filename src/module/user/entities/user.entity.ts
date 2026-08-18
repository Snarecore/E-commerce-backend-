import { AbstractEntity } from 'src/database/abstract.entity';
import { Role } from 'src/enums/role.enum';
import { ProductComment } from 'src/module/inventory/product-comment/entities/product-comment.entity';
import { Orders } from 'src/module/order/entity/order.entity';
import { Column, Entity, Index, OneToMany } from 'typeorm';

@Entity('user')
export class User extends AbstractEntity {
	@Column({ type: 'varchar', nullable: false })
	name: string;

	@Column({ type: 'varchar', nullable: false, unique: true })
	email: string;

	@Column({ type: 'varchar', nullable: false })
	password: string;

	@Column({ type: 'varchar', nullable: false })
	phone: string;

	@Column({ type: 'varchar', nullable: true })
	refreshToken: string;

	@Column({ nullable: true })
	resetToken: string;

	@Column({ nullable: true, type: 'timestamp' })
	resetTokenExpiry: Date;

	@Column({ type: 'enum', enum: Role, nullable: false })
	role: Role;

	@OneToMany(() => Orders, (order) => order.user)
	orders: Orders[];

	@OneToMany(() => ProductComment, (c) => c.user)
	productComments?: ProductComment[];
}
