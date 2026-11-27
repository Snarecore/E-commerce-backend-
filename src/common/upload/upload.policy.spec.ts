import { BadRequestException } from '@nestjs/common';
import { assertAllowedFileContent, detectFileKind, UploadPolicy, uploadOptions } from './upload.policy';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pdf = Buffer.from('%PDF-1.7\n........');
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe('upload policy', () => {
    it('detects real file content regardless of the declared type', () => {
        expect(detectFileKind(png)).toEqual({ kind: 'image', mime: 'image/png' });
        expect(detectFileKind(pdf)).toEqual({ kind: 'pdf', mime: 'application/pdf' });
        expect(detectFileKind(svg)).toBeNull();
    });

    it('rejects content outside the allowed kinds', () => {
        expect(() => assertAllowedFileContent(svg, ['image', 'pdf'])).toThrow(BadRequestException);
        expect(() => assertAllowedFileContent(pdf, UploadPolicy.CUSTOMER_IMAGE.allowed)).toThrow(BadRequestException);
        expect(assertAllowedFileContent(png, UploadPolicy.CUSTOMER_IMAGE.allowed).kind).toBe('image');
    });

    it('builds multer options with size caps and a MIME allow-list', () => {
        const options = uploadOptions(UploadPolicy.CUSTOMER_IMAGE);
        expect(options.limits).toMatchObject({ fileSize: 5 * 1024 * 1024, files: 1 });

        const callback = jest.fn();
        options.fileFilter!({} as never, { mimetype: 'image/svg+xml' } as never, callback);
        expect(callback.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
        options.fileFilter!({} as never, { mimetype: 'image/png' } as never, callback);
        expect(callback).toHaveBeenLastCalledWith(null, true);
    });
});
