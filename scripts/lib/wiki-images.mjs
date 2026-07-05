// Miroir local des images BookStack : telechargement, WebP, lazy loading.
// Fonctions pures testees ; le reseau/sharp vit dans WikiImageMirror.

import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { escapeAttr, site, withBasePath } from './site-template.mjs';

export const WIKI_UPLOADS_PATH = '/uploads/';

/**
 * @param {string} uploadsBase URL racine uploads BookStack (ex. https://librenard.fr/wiki/uploads)
 */
export function extractUploadUrls(html, uploadsBase) {
    const base = uploadsBase.replace(/\/$/, '');
    const urls = new Set();
    const re = new RegExp(`${escapeRegex(base)}/([^"'\\s>]+)`, 'g');
    for (const m of String(html).matchAll(re)) {
        urls.add(`${base}/${m[1]}`);
    }
    return [...urls];
}

export function altFromFilename(filename) {
    const base = String(filename)
        .replace(/\.[^.]+$/, '')
        .replace(/^scaled-\d+-?$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
    if (!base || /^image$/i.test(base)) return '';
    return base.charAt(0).toUpperCase() + base.slice(1);
}

export function isBadAlt(alt) {
    if (!alt) return true;
    return /\.(png|jpe?g|gif|webp|svg)$/i.test(alt) || /^image$/i.test(alt);
}

export function localMirrorPath(uploadUrl, uploadsBase) {
    const base = uploadsBase.replace(/\/$/, '');
    const rel = uploadUrl.startsWith(base) ? uploadUrl.slice(base.length + 1) : uploadUrl;
    const parsed = path.posix.parse(rel);
    return path.posix.join('images/wiki', parsed.dir, `${parsed.name}.webp`);
}

export function relAssetHref(fromOutput, assetPath) {
    const rel = path.posix.relative(path.posix.dirname(fromOutput), assetPath);
    return rel.startsWith('.') ? rel : `./${rel}`;
}

/**
 * Reecrit src/href uploads vers chemins locaux + lazy loading + alt.
 * @param {string} html
 * @param {Map<string, { path: string, width?: number, height?: number, alt?: string }>} urlMap cle = URL absolue uploads
 * @param {{ fromOutput: string, eagerFirst?: boolean }} opts
 */
export function rewriteImagesInHtml(html, urlMap, { fromOutput, eagerFirst = true } = {}) {
    if (!urlMap.size) return html;
    let imgIndex = 0;

    let out = String(html).replace(/<img\b([^>]*?)>/gi, (full, attrs) => {
        const srcMatch = attrs.match(/\bsrc="([^"]+)"/);
        if (!srcMatch) return full;
        const mapped = urlMap.get(srcMatch[1]);
        if (!mapped) return full;

        const href = relAssetHref(fromOutput, mapped.path);
        let newAttrs = attrs.replace(/\bsrc="[^"]+"/, `src="${escapeAttr(href)}"`);

        if (mapped.width && !/\bwidth=/.test(newAttrs)) {
            newAttrs += ` width="${mapped.width}" height="${mapped.height}"`;
        }
        if (!/\bloading=/.test(newAttrs)) {
            const eager = eagerFirst && imgIndex === 0;
            newAttrs += ` loading="${eager ? 'eager' : 'lazy'}" decoding="async"`;
        }

        const altMatch = newAttrs.match(/\balt="([^"]*)"/);
        const alt = altMatch ? altMatch[1] : '';
        if (isBadAlt(alt) && mapped.alt) {
            const safeAlt = escapeAttr(mapped.alt);
            newAttrs = altMatch
                ? newAttrs.replace(/\balt="[^"]*"/, `alt="${safeAlt}"`)
                : `${newAttrs} alt="${safeAlt}"`;
        }

        imgIndex++;
        return `<img${newAttrs}>`;
    });

    for (const [remote, mapped] of urlMap) {
        const href = relAssetHref(fromOutput, mapped.path);
        out = out.split(remote).join(href);
    }

    return out;
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class WikiImageMirror {
    /**
     * @param {string} rootDir Racine du depot
     * @param {string} uploadsBase ex. https://librenard.fr/wiki/uploads
     * @param {string} apiToken Token BookStack pour telecharger les uploads prives
     */
    constructor(rootDir, uploadsBase, apiToken) {
        this.rootDir = rootDir;
        this.uploadsBase = uploadsBase.replace(/\/$/, '');
        this.apiToken = apiToken;
        /** @type {Map<string, { path: string, width?: number, height?: number, alt?: string }>} */
        this.cache = new Map();
    }

    async mirrorUrl(remoteUrl) {
        if (!remoteUrl.startsWith(this.uploadsBase)) return remoteUrl;
        if (this.cache.has(remoteUrl)) return this.cache.get(remoteUrl).path;

        const rel = remoteUrl.slice(this.uploadsBase.length + 1);
        const localRel = localMirrorPath(remoteUrl, this.uploadsBase);
        const dest = path.join(this.rootDir, localRel);
        await mkdir(path.dirname(dest), { recursive: true });

        if (!(await fileExists(dest))) {
            const res = await fetch(remoteUrl, {
                headers: { Authorization: `Token ${this.apiToken}` }
            });
            if (!res.ok) throw new Error(`Image ${remoteUrl} : HTTP ${res.status}`);
            const input = Buffer.from(await res.arrayBuffer());
            const image = sharp(input);
            const meta = await image.metadata();
            await image.webp({ quality: 85 }).toFile(dest);
            const entry = {
                path: localRel.replace(/\\/g, '/'),
                width: meta.width,
                height: meta.height,
                alt: altFromFilename(path.posix.basename(rel))
            };
            this.cache.set(remoteUrl, entry);
            return entry.path;
        }

        const meta = await sharp(dest).metadata();
        const entry = {
            path: localRel.replace(/\\/g, '/'),
            width: meta.width,
            height: meta.height,
            alt: altFromFilename(path.posix.basename(rel))
        };
        this.cache.set(remoteUrl, entry);
        return entry.path;
    }

    async processHtml(html, fromOutput) {
        const urls = extractUploadUrls(html, this.uploadsBase);
        for (const url of urls) {
            await this.mirrorUrl(url);
        }
        const rewritten = rewriteImagesInHtml(html, this.cache, { fromOutput });
        return this.absolutizeMetaImageUrls(rewritten, fromOutput);
    }

    /** Meta OG / JSON-LD exigent des URLs absolues, pas les chemins relatifs du corps. */
    absolutizeMetaImageUrls(html, fromOutput) {
        let out = html;
        for (const entry of this.cache.values()) {
            const rel = relAssetHref(fromOutput, entry.path);
            const abs = `${site.url}${withBasePath(`/${entry.path}`)}`;
            out = out.split(`content="${rel}"`).join(`content="${abs}"`);
            out = out.split(`"image":"${rel}"`).join(`"image":"${abs}"`);
        }
        return out;
    }

    /** @param {string} remoteUrl */
    absoluteSiteUrl(remoteUrl) {
        const mapped = this.cache.get(remoteUrl);
        if (!mapped) return remoteUrl;
        return `${site.url}${withBasePath(`/${mapped.path}`)}`;
    }
}

async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}
