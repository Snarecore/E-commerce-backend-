import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/**
 * Single source of truth for what the API accepts as an uploaded file.
 *
 * Every FileInterceptor / FileFieldsInterceptor passes `uploadOptions(<policy>)`, and
 * SpaceService re-checks the file's real bytes before it leaves the server. SVG and HTML are
 * deliberately never allowed: they execute script when opened from the CDN.
 */
export type UploadKind = 'image' | 'pdf';

export interface UploadPolicyDefinition {
    readonly name: string;
    readonly maxFileSizeBytes: number;
    readonly maxFiles: number;
    readonly allowed: readonly UploadKind[];
}

const MB = 1024 * 1024;

export const UploadPolicy = {
    /** Customer-supplied images (profile photo). */
    CUSTOMER_IMAGE: { name: 'customer image', maxFileSizeBytes: 5 * MB, maxFiles: 1, allowed: ['image'] },
    /** Chat attachments: screenshots and invoices. */
    CHAT_ATTACHMENT: { name: 'chat attachment', maxFileSizeBytes: 5 * MB, maxFiles: 1, allowed: ['image', 'pdf'] },
    /** Admin catalogue and CMS media. */
    ADMIN_MEDIA: { name: 'admin media', maxFileSizeBytes: 10 * MB, maxFiles: 10, allowed: ['image', 'pdf'] },
} as const satisfies Record<string, UploadPolicyDefinition>;

const MIME_BY_KIND: Record<UploadKind, readonly string[]> = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    pdf: ['application/pdf'],
};

const allowedMimes = (policy: UploadPolicyDefinition): string[] => policy.allowed.flatMap((kind) => MIME_BY_KIND[kind]);

/** Multer options for an interceptor: size/count capped, MIME allow-listed. */
export function uploadOptions(policy: UploadPolicyDefinition): MulterOptions {
    const mimes = allowedMimes(policy);
    return {
        // No `storage`/`dest`: Nest's multer integration keeps files in memory (file.buffer)
        limits: { fileSize: policy.maxFileSizeBytes, files: policy.maxFiles, fields: 100 },
        fileFilter: (_req, file, callback) => {
            if (mimes.includes(file.mimetype)) return callback(null, true);
            callback(new BadRequestException(`Unsupported file type "${file.mimetype}" for ${policy.name}. Allowed: ${mimes.join(', ')}.`), false);
        },
    };
}

/**
 * Identifies a file from its first bytes. The declared Content-Type is client-controlled, so
 * this is what actually decides whether a file is an image, a PDF, or something to reject.
 */
export function detectFileKind(buffer: Buffer): { kind: UploadKind; mime: string } | null {
    if (!buffer || buffer.length < 12) return null;
    const ascii = (start: number, end: number) => buffer.subarray(start, end).toString('latin1');

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { kind: 'image', mime: 'image/jpeg' };
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { kind: 'image', mime: 'image/png' };
    }
    if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return { kind: 'image', mime: 'image/gif' };
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp' };
    if (ascii(4, 12) === 'ftypavif' || ascii(4, 12) === 'ftypavis') return { kind: 'image', mime: 'image/avif' };
    if (ascii(0, 5) === '%PDF-') return { kind: 'pdf', mime: 'application/pdf' };
    return null;
}

/** Throws unless the file's real content is one of the kinds the policy allows. */
export function assertAllowedFileContent(buffer: Buffer, allowed: readonly UploadKind[]): { kind: UploadKind; mime: string } {
    const detected = detectFileKind(buffer);
    if (!detected || !allowed.includes(detected.kind)) {
        throw new BadRequestException(`File content is not an allowed type (${allowed.join(', ')}).`);
    }
    return detected;
}
