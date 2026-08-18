import {
	PrimaryGeneratedColumn,
	BaseEntity,
	CreateDateColumn,
	UpdateDateColumn,
	Column
} from 'typeorm';

export abstract class AbstractEntity extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;
	
	@CreateDateColumn({ type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ type: 'timestamp' })
	updatedAt: Date;

	@Column({ type: 'boolean', default: false })
	isDeleted: boolean;
}
