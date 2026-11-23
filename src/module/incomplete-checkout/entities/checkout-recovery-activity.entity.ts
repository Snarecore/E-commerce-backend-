import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { RecoveryAction } from '../enums/recovery-action.enum';
import { IncompleteCheckout } from './incomplete-checkout.entity';
import { User } from '../../user/entities/user.entity';

@Entity('checkout_recovery_activities')
@Index('IDX_recovery_activities_checkout_created', ['checkoutId', 'createdAt'])
@Index('IDX_recovery_activities_admin', ['adminId'])
export class CheckoutRecoveryActivity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 36 })
    checkoutId: string;

    @ManyToOne(() => IncompleteCheckout, (checkout) => checkout.recoveryActivities, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'checkoutId' })
    checkout: IncompleteCheckout;

    @Column({ type: 'varchar', length: 36, nullable: true })
    adminId: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'adminId' })
    admin?: User | null;

    @Column({
        type: 'enum',
        enum: RecoveryAction,
    })
    action: RecoveryAction;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
    createdAt: Date;
}
