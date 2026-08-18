import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import { SesHttpClient } from './ses-http.client';

export interface ResetPasswordMailDto {
    to: string[];          
    from: string;        
    subject: string;   
    username: string;
    token: string;
    email: string;
    companyEmail?: string;
    bcc?: string[];
}

@Injectable()
export class SesEmailService {
    private client: SesHttpClient;

    constructor(private readonly config: ConfigService) {
        const region = this.config.get<string>('AWS_REGION')!;
        const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID')!;
        const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY')!;
        this.client = new SesHttpClient(region, accessKeyId, secretAccessKey);
    }

    private async renderForgotPasswordTemplate(ctx: Record<string, unknown>) {
        const file = path.join(process.cwd(), 'templates', 'forgot_password_email.hbs');
        const source = await fs.readFile(file, 'utf8');
        const template = Handlebars.compile(source, { strict: true });
        return template(ctx);
    }

    async sendResetPasswordEmail(dto: ResetPasswordMailDto) {
        const html = await this.renderForgotPasswordTemplate({
            username: dto.username,
            token: dto.token,
            email: dto.email,
            passwordResetURL: this.config.get<string>('PASSWORD_RESET_PAGE'),
            companyEmail: dto.companyEmail
        });

        const payload = {
            FromEmailAddress: this.extractFromEmail(dto.from) ?? this.config.get<string>('SES_FROM_EMAIL'),
            Destination: {
                ToAddresses: dto.to,
                ...(dto.bcc?.length ? { BccAddresses: dto.bcc } : {})
            },
            Content: {
                Simple: {
                    Subject: { Data: dto.subject },
                    Body: { Html: { Data: html } }
                }
            },
            ...(this.config.get('SES_CONFIGURATION_SET')
                ? { ConfigurationSetName: this.config.get('SES_CONFIGURATION_SET') }
                : {})
        };

        const res = await this.client.sendOutboundEmail(payload);
        return { message: `Mail sent to: ${dto.to[0]}`, ses: res };
    }

    private extractFromEmail(from: string | undefined): string | undefined {
        if (!from) return undefined;
        const match = from.match(/<([^>]+)>/);
        return match ? match[1] : from;
    }
}
