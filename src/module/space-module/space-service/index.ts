/** A file received through a multipart FileInterceptor (kept in memory, see common/upload/upload.policy.ts). */
export interface UploadMulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
}
