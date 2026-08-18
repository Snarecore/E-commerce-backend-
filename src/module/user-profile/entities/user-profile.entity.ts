import { AbstractEntity } from 'src/database/abstract.entity';
import { User } from 'src/module/user/entities/user.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('user-profile')
export class UserProfile extends AbstractEntity {
    @Column({ type: 'varchar', nullable: true, default: 'https://cdn.bazaarbound.com/user-avatar.svg' })
    profileImage: string;

    @Column({ type: 'varchar', nullable: true })
    shopName: string;

    @Column({ type: 'varchar', nullable: true })
    shopImage: string;

    @Column({ type: 'varchar', nullable: true })
    accountNumber: string;

    @Column({ type: 'varchar', nullable: true })
    accountHolderName: string;

    @Column({ type: 'varchar', nullable: true })
    bankName: string;

    @Column({ type: 'varchar', nullable: true })
    branchName: string;

    @Column({ type: 'varchar', nullable: true })
    IBAN: string;

    @Column({ type: 'varchar', nullable: true })
    country: string;

    @Column({ type: 'varchar', nullable: true })
    swiftCode: string;

    @Column({ type: 'varchar', nullable: true })
    paypalEmailAddress: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;
}
