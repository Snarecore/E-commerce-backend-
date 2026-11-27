import { FilterXSS, IFilterXSSOptions } from 'xss';

/**
 * Rich text written in the admin editor (product descriptions, CMS copy) is rendered as HTML on
 * the storefront and in the admin panel. It is sanitised on the way in so a stored script can
 * never run there: formatting, lists, tables, links and images survive; scripts, event handlers,
 * iframes, inline styles and `javascript:` URLs do not.
 */
const SAFE_URL = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;

const RICH_TEXT_TAGS: Record<string, string[]> = {
    p: ['class'], br: [], hr: [], span: ['class'], div: ['class'], blockquote: ['class'], pre: ['class'], code: ['class'],
    h1: ['class'], h2: ['class'], h3: ['class'], h4: ['class'], h5: ['class'], h6: ['class'],
    strong: [], b: [], em: [], i: [], u: [], s: [], sub: [], sup: [], mark: [], small: [],
    ul: ['class'], ol: ['class'], li: ['class'],
    table: ['class'], thead: [], tbody: [], tfoot: [], tr: [], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'], caption: [],
    a: ['href', 'title', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    figure: ['class'], figcaption: [],
};

const richTextFilter = new FilterXSS({
    whiteList: RICH_TEXT_TAGS,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'noscript'],
    css: false,
    safeAttrValue(tag, name, value) {
        if ((name === 'href' || name === 'src') && !SAFE_URL.test(value.trim())) return '';
        return value.replace(/"/g, '&quot;');
    },
} as IFilterXSSOptions);

const plainTextFilter = new FilterXSS({
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
});

export function sanitizeRichText(html: string | null | undefined): string | null | undefined {
    if (html === null || html === undefined) return html;
    // rel is not accepted from input; every surviving link gets a safe one (no opener access, no SEO juice)
    return richTextFilter.process(String(html)).replace(/<a\b/gi, '<a rel="noopener noreferrer nofollow"');
}

/** Strips every tag, for fields that must be plain text (titles, summaries, names). */
export function toPlainText(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined) return value;
    return plainTextFilter.process(String(value)).replace(/\s+/g, ' ').trim();
}
