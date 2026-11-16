import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailSettingRepository } from './email-setting.repository';
import { UpdateEmailSettingDto } from './dto/update-email-setting.dto';
import { TestEmailSettingDto } from './dto/test-email-setting.dto';
import { EmailProviderType, EmailSetting } from './entities/email-setting.entity';
import { encryptSmtpPassword, decryptSmtpPassword } from '../../../utils/smtp-crypto.util';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailSettingService {
    private readonly logger = new Logger(EmailSettingService.name);
    private cachedTransporter: nodemailer.Transporter | null = null;
    private cachedSenderFrom: string | null = null;

    constructor(
        private readonly repository: EmailSettingRepository,
        private readonly configService: ConfigService
    ) {}

    private getSecret(): string {
        return this.configService.get<string>('SMTP_ENCRYPTION_KEY') || this.configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'bazaarbound_smtp_secret_2026';
    }

    /**
     * Guard against Server-Side Request Forgery (SSRF) by disallowing private IP ranges,
     * loopback addresses, and cloud instance metadata endpoints.
     */
    private validateSmtpHost(rawHost: string): void {
        if (!rawHost || typeof rawHost !== 'string') {
            throw new BadRequestException('A valid SMTP host must be provided.');
        }
        const host = rawHost.trim().toLowerCase();

        const disallowedNames = [
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
            '::1',
            '169.254.169.254',
            'metadata.google.internal',
            'instance-data'
        ];

        if (disallowedNames.includes(host)) {
            throw new BadRequestException('Localhost, loopback, and cloud metadata hosts are disallowed for security reasons.');
        }

        const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = host.match(ipv4Regex);
        if (match) {
            const a = Number(match[1]);
            const b = Number(match[2]);
            const c = Number(match[3]);
            const d = Number(match[4]);

            if (a > 255 || b > 255 || c > 255 || d > 255) {
                throw new BadRequestException('Invalid IP address format for SMTP host.');
            }

            if (a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
                throw new BadRequestException('Private network and cloud metadata IP addresses are not permitted as SMTP hosts.');
            }
        }
    }

    /**
     * Retrieves the current email/SMTP configuration with masked password for admin UI.
     */
    async getSetting(): Promise<any> {
        try {
            const existing = await this.repository.findOneByQuery({ isDeleted: false });
            if (existing) {
                return {
                    id: existing.id,
                    provider: existing.provider || EmailProviderType.GMAIL,
                    host: existing.host,
                    port: existing.port,
                    secure: Boolean(existing.secure),
                    emailUser: existing.emailUser,
                    emailPass: existing.emailPass ? '••••••••' : '',
                    hasPassword: Boolean(existing.emailPass),
                    senderName: existing.senderName,
                    senderEmail: existing.senderEmail,
                    replyTo: existing.replyTo || '',
                    isActive: Boolean(existing.isActive),
                    updatedAt: existing.updatedAt
                };
            }

            // Fallback to .env defaults if no DB row has been customized yet
            const defaultPort = parseInt(String(this.configService.get('EMAIL_PORT') ?? '465'), 10);
            const defaultUser = this.configService.get<string>('EMAIL_USER') || process.env.EMAIL_USER || '';
            const defaultPass = this.configService.get<string>('EMAIL_PASS') || process.env.EMAIL_PASS || '';

            return {
                id: null,
                provider: EmailProviderType.GMAIL,
                host: this.configService.get<string>('EMAIL_HOST') || process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: defaultPort,
                secure: defaultPort === 465,
                emailUser: defaultUser,
                emailPass: defaultPass ? '••••••••' : '',
                hasPassword: Boolean(defaultPass),
                senderName: this.configService.get<string>('EMAIL_SENDER_NAME') || process.env.EMAIL_SENDER_NAME || 'Fashion Time',
                senderEmail: this.configService.get<string>('EMAIL_SENDER_MAIL') || process.env.EMAIL_SENDER_MAIL || defaultUser,
                replyTo: '',
                isActive: true,
                isFromEnvFallback: true
            };
        } catch (error: any) {
            this.logger.error(`[EmailSettingService] getSetting error: ${error?.message}`);
            throw new HttpException(error?.message || 'Failed to load email settings', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Saves or updates the SMTP configuration, encrypting the password.
     */
    async saveSetting(dto: UpdateEmailSettingDto): Promise<any> {
        this.validateSmtpHost(dto.host);
        try {
            const existing = await this.repository.findOneByQuery({ isDeleted: false });
            const secret = this.getSecret();

            let finalEncryptedPass = '';
            if (dto.emailPass && dto.emailPass !== '••••••••') {
                finalEncryptedPass = encryptSmtpPassword(dto.emailPass.trim(), secret);
            } else if (existing?.emailPass) {
                finalEncryptedPass = existing.emailPass;
            } else {
                const envPass = this.configService.get<string>('EMAIL_PASS') || process.env.EMAIL_PASS || '';
                finalEncryptedPass = encryptSmtpPassword(envPass.trim(), secret);
            }

            const payload: Partial<EmailSetting> = {
                provider: dto.provider || EmailProviderType.GMAIL,
                host: dto.host.trim(),
                port: Number(dto.port),
                secure: dto.secure !== undefined ? dto.secure : Number(dto.port) === 465,
                emailUser: dto.emailUser.trim(),
                emailPass: finalEncryptedPass,
                senderName: dto.senderName.trim(),
                senderEmail: dto.senderEmail.trim(),
                replyTo: dto.replyTo?.trim() || null,
                isActive: dto.isActive !== undefined ? dto.isActive : true
            };

            let saved: EmailSetting;
            if (existing) {
                await this.repository.update(existing.id, payload);
                saved = (await this.repository.findOne(existing.id))!;
            } else {
                saved = await this.repository.create(payload as any);
            }

            // Invalidate cached transporter so new credentials take effect immediately with zero downtime
            if (this.cachedTransporter) {
                try {
                    this.cachedTransporter.close();
                } catch {
                    // ignore
                }
                this.cachedTransporter = null;
                this.cachedSenderFrom = null;
            }

            return {
                id: saved.id,
                provider: saved.provider,
                host: saved.host,
                port: saved.port,
                secure: Boolean(saved.secure),
                emailUser: saved.emailUser,
                emailPass: '••••••••',
                hasPassword: Boolean(saved.emailPass),
                senderName: saved.senderName,
                senderEmail: saved.senderEmail,
                replyTo: saved.replyTo || '',
                isActive: Boolean(saved.isActive),
                updatedAt: saved.updatedAt
            };
        } catch (error: any) {
            this.logger.error(`[EmailSettingService] saveSetting error: ${error?.message}`);
            throw new HttpException(error?.message || 'Failed to save email settings', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Resolves the authoritative decrypted plain SMTP credentials for active mail sending.
     */
    async getActiveTransporterConfig(): Promise<{
        host: string;
        port: number;
        secure: boolean;
        auth: { user: string; pass: string };
        from: string;
        isActive: boolean;
    } | null> {
        try {
            const existing = await this.repository.findOneByQuery({ isDeleted: false, isActive: true });
            const secret = this.getSecret();

            if (existing && existing.emailUser && existing.emailPass) {
                const plainPass = decryptSmtpPassword(existing.emailPass, secret);
                return {
                    host: existing.host,
                    port: Number(existing.port),
                    secure: Boolean(existing.secure),
                    auth: {
                        user: existing.emailUser,
                        pass: plainPass
                    },
                    from: `"${existing.senderName}" <${existing.senderEmail}>`,
                    isActive: existing.isActive
                };
            }
            return null;
        } catch (error: any) {
            this.logger.warn(`[EmailSettingService] getActiveTransporterConfig error: ${error?.message}`);
            return null;
        }
    }

    /**
     * Retrieves or instantiates high-performance connection-pooled transporter.
     */
    async getActiveTransporter(): Promise<{
        transporter: nodemailer.Transporter;
        from: string;
    } | null> {
        if (this.cachedTransporter && this.cachedSenderFrom) {
            return {
                transporter: this.cachedTransporter,
                from: this.cachedSenderFrom
            };
        }

        const config = await this.getActiveTransporterConfig();
        if (!config || !config.isActive) return null;

        this.cachedTransporter = nodemailer.createTransport({
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.auth.user,
                pass: config.auth.pass
            },
            connectionTimeout: 10000,
            greetingTimeout: 8000,
            socketTimeout: 10000
        });
        this.cachedSenderFrom = config.from;

        return {
            transporter: this.cachedTransporter,
            from: this.cachedSenderFrom
        };
    }

    /**
     * Tests live connection and sends a sample test email to verify credentials.
     */
    async testConnection(dto: TestEmailSettingDto): Promise<{ success: boolean; message: string }> {
        this.validateSmtpHost(dto.host);
        const secret = this.getSecret();
        let plainPass = (dto.emailPass || '').trim();

        if (!plainPass || plainPass === '••••••••') {
            const existing = await this.repository.findOneByQuery({ isDeleted: false });
            if (existing?.emailPass) {
                plainPass = decryptSmtpPassword(existing.emailPass, secret);
            } else {
                plainPass = (this.configService.get<string>('EMAIL_PASS') || process.env.EMAIL_PASS || '').trim();
            }
        }

        if (!plainPass) {
            throw new BadRequestException('Password or App Password is required to test SMTP connection.');
        }

        const port = Number(dto.port) || 465;
        const secure = dto.secure !== undefined ? dto.secure : port === 465;

        const transporter = nodemailer.createTransport({
            host: dto.host,
            port,
            secure,
            auth: {
                user: dto.emailUser,
                pass: plainPass
            },
            connectionTimeout: 15000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });

        // Step 1: Verify SMTP handshake & credentials
        try {
            await transporter.verify();
        } catch (verifyErr: any) {
            this.logger.error(`[EmailSettingService] SMTP Verification failed: ${verifyErr?.message}`);
            throw new BadRequestException(
                `SMTP Handshake Failed: ${verifyErr?.message || 'Invalid username, password, or host configuration.'}`
            );
        }

        // Step 2: Send sample test email to recipient
        try {
            const fromHeader = `"${dto.senderName || 'Fashion Time'}" <${dto.senderEmail || dto.emailUser}>`;
            await transporter.sendMail({
                from: fromHeader,
                to: dto.testRecipient,
                subject: `[Test Email] SMTP Configuration Verified - ${dto.senderName || 'Fashion Time'}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; rounded: 12px; background: #ffffff;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #059669; margin: 0;">✓ SMTP Configuration Successful!</h2>
                            <p style="color: #4b5563; font-size: 14px; margin-top: 6px;">Your email credentials are functioning correctly.</p>
                        </div>
                        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #374151;">
                            <p style="margin: 4px 0;"><strong>Provider:</strong> ${dto.provider || 'GMAIL'}</p>
                            <p style="margin: 4px 0;"><strong>SMTP Host:</strong> ${dto.host}:${port}</p>
                            <p style="margin: 4px 0;"><strong>Sender:</strong> ${fromHeader}</p>
                            <p style="margin: 4px 0;"><strong>Test Recipient:</strong> ${dto.testRecipient}</p>
                            <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                        </div>
                        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 24px;">
                            This test email was triggered from the Fashion Time Admin Dashboard.
                        </p>
                    </div>
                `
            });

            return {
                success: true,
                message: `SMTP connection verified and test email sent to ${dto.testRecipient} successfully!`
            };
        } catch (sendErr: any) {
            this.logger.error(`[EmailSettingService] Test mail delivery failed: ${sendErr?.message}`);
            throw new BadRequestException(
                `SMTP authenticated, but failed to deliver test email: ${sendErr?.message}`
            );
        }
    }
}
