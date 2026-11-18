import { AbstractEntity } from '../../../database/abstract.entity';
import { Role } from '../../../enums/role.enum';
import { ProductComment } from '../../inventory/product-comment/entities/product-comment.entity';
import { Orders } from '../../order/entity/order.entity';
import { Column, Entity, Index, OneToMany } from 'typeorm';

@Entity('user')
export class User extends AbstractEntity {
	@Column({ type: 'varchar', nullable: false })
	name: string;

	@Column({ type: 'varchar', nullable: false, unique: true })
	email: string;

	@Column({ type: 'varchar', nullable: false, select: false })
	password: string;

	@Column({ type: 'varchar', nullable: false })
	phone: string;

	@Column({ type: 'varchar', nullable: true, select: false })
	refreshToken: string;

	/** SHA-256 hex digest of the emailed reset code (never the code itself). */
	@Column({ type: 'varchar', length: 64, nullable: true, select: false })
	resetToken: string;

	@Column({ nullable: true, type: 'timestamp', select: false })
	resetTokenExpiry: Date;

	/** Wrong reset-code guesses against the current code. Reset to 0 whenever a new code is issued. */
	@Column({ type: 'int', nullable: false, default: 0, select: false })
	resetAttempts: number;

	@Column({ type: 'enum', enum: Role, nullable: false })
	role: Role;

	@OneToMany(() => Orders, (order) => order.user)
	orders: Orders[];

	@OneToMany(() => ProductComment, (c) => c.user)
	productComments?: ProductComment[];
}
