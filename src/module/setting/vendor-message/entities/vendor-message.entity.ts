import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('vendor-message')
export class VendorMessage extends AbstractEntity {
	@Column({ type: 'varchar' })
	name: string;

	@Column({ type: 'varchar' })
	email: string;

	@Column({ type: 'longtext' })
  	message: string;

	@Column({ type: 'varchar' })
	vendorId: string;
}
