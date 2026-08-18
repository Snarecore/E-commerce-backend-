import * as AWS from 'aws-sdk';
import { Provider } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

export const R2ServiceLib = 'lib:r2-service';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

const spaceEndpoint = new AWS.Endpoint(`https://${accountId}.r2.cloudflarestorage.com`);

const S3 = new AWS.S3({
    endpoint: spaceEndpoint.href,
    credentials: new AWS.Credentials({
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY!,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!
    }),
    s3ForcePathStyle: true
});

export const R2ServiceProvider: Provider<AWS.S3> = {
    provide: R2ServiceLib,
    useValue: S3
};

export interface UploadMulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
}
