import { sanitizeRichText, toPlainText } from './html-sanitizer.util';

describe('sanitizeRichText', () => {
    it('removes scripts, event handlers and javascript: links', () => {
        const dirty = '<p onclick="steal()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)>';
        const clean = sanitizeRichText(dirty)!;
        expect(clean).not.toMatch(/script|onclick|onerror|javascript:/i);
        expect(clean).toContain('<p>Hi</p>');
    });

    it('keeps formatting, lists, tables, links and https images', () => {
        const html = '<h2>Fit</h2><ul><li><strong>Slim</strong></li></ul><table><tr><td>M</td></tr></table><a href="https://shop.test">size guide</a><img src="https://cdn.test/a.png" alt="a">';
        const clean = sanitizeRichText(html)!;
        expect(clean).toContain('<strong>Slim</strong>');
        expect(clean).toContain('<td>M</td>');
        expect(clean).toContain('href="https://shop.test"');
        expect(clean).toContain('rel="noopener noreferrer nofollow"');
        expect(clean).toContain('src="https://cdn.test/a.png"');
    });

    it('drops entity-encoded and protocol-relative URLs', () => {
        const clean = sanitizeRichText('<a href="jav&#x61;script:alert(1)">a</a><img src="//evil.test/x.png"><a href=" JavaScript:alert(1)">b</a>')!;
        expect(clean).not.toMatch(/javascript|evil\.test/i);
    });

    it('passes null and undefined through', () => {
        expect(sanitizeRichText(null)).toBeNull();
        expect(sanitizeRichText(undefined)).toBeUndefined();
    });
});

describe('toPlainText', () => {
    it('strips all markup', () => {
        expect(toPlainText(' <b>Blue</b> <script>x()</script>shirt ')).toBe('Blue shirt');
    });
});
