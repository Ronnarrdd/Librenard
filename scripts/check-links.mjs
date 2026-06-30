import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const checkExternal = process.argv.includes('--external');
const siteHost = 'librenard.fr';
const siteBasePath = '/site';

const ignoredSchemes = new Set(['mailto:', 'tel:', 'javascript:', 'data:', 'blob:']);

async function listHtmlFiles(dir = rootDir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listHtmlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            files.push(fullPath);
        }
    }

    return files;
}

function parseAttributes(source) {
    const attrs = {};
    const attrRe = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const match of source.matchAll(attrRe)) {
        attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    return attrs;
}

function collectDocumentIds(html) {
    const ids = new Set();
    for (const match of html.matchAll(/\sid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/g)) {
        ids.add(match[1] ?? match[2] ?? match[3]);
    }
    return ids;
}

function collectLinks(html, filePath) {
    const links = [];
    const tagRe = /<([a-zA-Z][\w:-]*)([^>]*)>/g;

    for (const match of html.matchAll(tagRe)) {
        const tag = match[1].toLowerCase();
        const attrs = parseAttributes(match[2]);

        if (tag === 'a' && attrs.href) {
            links.push({ value: attrs.href, kind: 'link', filePath });
        }

        if (tag === 'script' && attrs.src) {
            links.push({ value: attrs.src, kind: 'script', filePath });
        }

        if (tag === 'link' && attrs.href) {
            const rel = (attrs.rel || '').toLowerCase();
            if (rel.includes('stylesheet') || rel.includes('manifest')) {
                links.push({ value: attrs.href, kind: rel, filePath });
            }
        }
    }

    return links;
}

function isExternal(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function shouldIgnore(value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '#') return true;

    for (const scheme of ignoredSchemes) {
        if (trimmed.toLowerCase().startsWith(scheme)) return true;
    }

    return false;
}

function resolveLocalTarget(value, sourceFile) {
    const [withoutHash] = value.split('#');
    let withoutQuery = withoutHash.split('?')[0];

    if (!withoutQuery) return sourceFile;

    if (withoutQuery.startsWith('/')) {
        if (siteBasePath && (withoutQuery === siteBasePath || withoutQuery.startsWith(`${siteBasePath}/`))) {
            withoutQuery = withoutQuery.slice(siteBasePath.length) || '/';
        }
        if (withoutQuery === '/') return path.join(rootDir, 'index.html');
        return path.join(rootDir, withoutQuery.replace(/^\/+/, ''));
    }

    return path.resolve(path.dirname(sourceFile), withoutQuery);
}

function anchorFor(value) {
    const hashIndex = value.indexOf('#');
    if (hashIndex === -1) return null;
    const hash = value.slice(hashIndex + 1);
    return hash ? decodeURIComponent(hash) : null;
}

async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch (_) {
        return false;
    }
}

async function checkLocalLink(link, htmlCache, idCache) {
    const target = resolveLocalTarget(link.value, link.filePath);
    if (!await exists(target)) {
        return `Introuvable: ${relative(link.filePath)} -> ${link.value}`;
    }

    const anchor = anchorFor(link.value);
    if (!anchor || !target.endsWith('.html')) return null;

    if (!idCache.has(target)) {
        const html = htmlCache.get(target) ?? await readFile(target, 'utf8');
        htmlCache.set(target, html);
        idCache.set(target, collectDocumentIds(html));
    }

    if (!idCache.get(target).has(anchor)) {
        return `Ancre introuvable: ${relative(link.filePath)} -> ${link.value}`;
    }

    return null;
}

async function checkRemoteLink(link) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        let response = await fetch(link.value, {
            method: 'HEAD',
            redirect: 'follow',
            signal: controller.signal
        });

        if (response.status === 405 || response.status === 403) {
            response = await fetch(link.value, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal
            });
        }

        if (response.status >= 400) {
            return `HTTP ${response.status}: ${relative(link.filePath)} -> ${link.value}`;
        }
    } catch (error) {
        return `Erreur externe: ${relative(link.filePath)} -> ${link.value} (${error.message})`;
    } finally {
        clearTimeout(timeout);
    }

    return null;
}

function relative(filePath) {
    return path.relative(rootDir, filePath).replaceAll(path.sep, '/');
}

const htmlFiles = await listHtmlFiles();
const htmlCache = new Map();
const idCache = new Map();
const failures = [];
const externalLinks = [];

for (const filePath of htmlFiles) {
    const html = await readFile(filePath, 'utf8');
    htmlCache.set(filePath, html);

    for (const link of collectLinks(html, filePath)) {
        if (shouldIgnore(link.value)) continue;

        if (isExternal(link.value)) {
            const url = new URL(link.value);
            if (url.hostname === siteHost && url.pathname.endsWith('.html')) {
                const localValue = `${url.pathname}${url.hash}`;
                const failure = await checkLocalLink({ ...link, value: localValue }, htmlCache, idCache);
                if (failure) failures.push(failure);
            } else {
                externalLinks.push(link);
            }
            continue;
        }

        const failure = await checkLocalLink(link, htmlCache, idCache);
        if (failure) failures.push(failure);
    }
}

if (checkExternal) {
    for (const link of externalLinks) {
        const failure = await checkRemoteLink(link);
        if (failure) failures.push(failure);
    }
} else if (externalLinks.length) {
    console.log(`Liens externes ignorés (${externalLinks.length}). Lancez npm run check:links:external pour les vérifier.`);
}

if (failures.length) {
    console.error('\nLiens cassés détectés:');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log(`Vérification OK: ${htmlFiles.length} fichiers HTML analysés.`);
