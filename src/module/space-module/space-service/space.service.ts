import { Injectable, Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { UploadMulterFile } from '.';
import { assertAllowedFileContent, UploadKind } from '../../../common/upload/upload.policy';

dotenv.config();

@Injectable()
export class SpaceService {
    private readonly logger = new Logger(SpaceService.name);

    constructor() {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
    }

    /**
     * Uploads a user/admin file. The real content is checked first (see upload.policy.ts), so a
     * renamed SVG/HTML file is rejected even if the interceptor's MIME filter was bypassed.
     * Images are stored as Cloudinary images; PDFs as `raw`, which is served as a download
     * instead of being rendered.
     */
    async uploadFile(
        file: UploadMulterFile,
        uploadLocation?: string,
        allowed: readonly UploadKind[] = ['image', 'pdf']
    ): Promise<string | undefined> {
        if (!file || !file.buffer) return undefined;
        const { kind } = assertAllowedFileContent(file.buffer, allowed);

        const originalName = file.originalname || 'file';
        const dot = originalName.lastIndexOf('.');
        const baseName = dot > 0 ? originalName.substring(0, dot) : originalName;
        const cleanName = baseName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60) || 'file';
        const isImage = kind === 'image';

        return new Promise<string | undefined>((resolve) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: uploadLocation || 'bazaarbound',
                    public_id: `${cleanName}_${uuidv4()}`,
                    resource_type: isImage ? 'image' : 'raw',
                    quality: isImage ? 'auto:good' : undefined,
                    fetch_format: isImage ? 'auto' : undefined,
                },
                (error, result) => {
                    if (error) {
                        this.logger.error(`Cloudinary upload failed: ${error.message}`);
                        resolve(undefined);
                    } else {
                        resolve(result?.secure_url);
                    }
                }
            );
            uploadStream.end(file.buffer);
        });
    }

    async uploadBufferFile(
        buffer: Buffer,
        uploadLocation: string,
        fileType: string = 'pdf'
    ): Promise<string | undefined> {
        const uniqueId = uuidv4();
        return new Promise<string | undefined>((resolve) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: uploadLocation,
                    public_id: uniqueId,
                    resource_type: 'raw'
                },
                (error, result) => {
                    if (error) {
                        this.logger.error(`Cloudinary buffer upload failed: ${error.message}`);
                        resolve(undefined);
                    } else {
                        resolve(result?.secure_url);
                    }
                }
            );
            uploadStream.end(buffer);
        });
    }
}
