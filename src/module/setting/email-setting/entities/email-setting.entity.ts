import { AbstractEntity } from '../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

export enum EmailProviderType {
    GMAIL = 'GMAIL',
    CUSTOM_SMTP = 'CUSTOM_SMTP',
    SENDGRID = 'SENDGRID',
    SES = 'SES'
}

@Entity('email_settings')
export class EmailSetting extends AbstractEntity {
    @Column({ type: 'varchar', length: 32, default: EmailProviderType.GMAIL })
    provider: EmailProviderType;

    @Column({ type: 'varchar', length: 128, default: 'smtp.gmail.com' })
    host: string;

    @Column({ type: 'int', default: 465 })
    port: number;

    @Column({ type: 'boolean', default: true })
    secure: boolean;

    @Column({ type: 'varchar', length: 128 })
    emailUser: string;

    @Column({ type: 'text' })
    emailPass: string;

    @Column({ type: 'varchar', length: 128, default: 'Fashion Time' })
    senderName: string;

    @Column({ type: 'varchar', length: 128 })
    senderEmail: string;

    @Column({ type: 'varchar', length: 128, nullable: true })
    replyTo: string | null;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;
}
