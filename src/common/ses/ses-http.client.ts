import * as aws4 from 'aws4';
import axios from 'axios';

export class SesHttpClient {
    constructor(
        private readonly region: string,
        private readonly accessKeyId: string,
        private readonly secretAccessKey: string,
    ) { }

    private get host() {
        return `email.${this.region}.amazonaws.com`;
    }
    private get endpoint() {
        return `https://${this.host}`;
    }

    async sendOutboundEmail(payload: unknown) {
        const path = '/v2/email/outbound-emails';
        const body = JSON.stringify(payload);

        const req: aws4.Request = {
            host: this.host,
            method: 'POST',
            path,
            service: 'ses',
            region: this.region,
            headers: { 'Content-Type': 'application/json' },
            body,
        };

        const signed = aws4.sign(req, {
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey,
        });

        const url = `${this.endpoint}${path}`;
        const res = await axios.post(url, body, {
            headers: signed.headers as Record<string, string>,
            maxBodyLength: Infinity,
            validateStatus: () => true
        });

        if (res.status < 200 || res.status >= 300) {
            throw new Error(
                `SES send failed (${res.status}): ${JSON.stringify(res.data)}`
            );
        }
        return res.data;
    }
}
