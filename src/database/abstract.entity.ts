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
	
	@CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
	createdAt: Date;

	@UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
	updatedAt: Date;

	@Column({ type: 'boolean', default: false })
	isDeleted: boolean;
}
