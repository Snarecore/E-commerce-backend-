import { extname } from 'path';
import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { UploadMulterFile } from '.';

dotenv.config();

@Injectable()
export class SpaceService {
    constructor() {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
    }

    async uploadFile(file: UploadMulterFile, uploadLocation?: string): Promise<string | undefined> {
        if (!file || !file.buffer) return undefined;
        const extension = extname(file.originalname || '');
        const nameWithoutExt = file.originalname ? file.originalname.substring(0, file.originalname.lastIndexOf('.')) : 'file';
        const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
        const uniqueId = uuidv4();
        
        let folder = 'bazaarbound';
        if (uploadLocation) {
            folder = uploadLocation;
        }

        const isImage = file.mimetype ? file.mimetype.startsWith('image/') : true;
        const resourceType = isImage ? 'image' : 'auto';

        return new Promise<string | undefined>((resolve) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                    public_id: `${cleanName}_${uniqueId}`,
                    resource_type: resourceType,
                    quality: isImage ? 'auto:good' : undefined,
                    fetch_format: isImage ? 'auto' : undefined,
                },
                (error, result) => {
                    if (error) {
                        console.error('Error uploading object to Cloudinary:', error);
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
                        console.error('Error uploading buffer file to Cloudinary:', error);
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
