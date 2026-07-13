import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const checkExternal = process.argv.includes('--external');
const siteHost = 'librenard.fr';
const siteBasePath = '/site';

const ignoredSchemes = new Set(['mailto:', 'tel:', 'javascript:', 'data:', 'blob:']);

// Liens valides dans un navigateur mais inaccessibles aux requetes automatiques (WAF, anti-bot).
const externalAllowlist = new Set([
    'https://www.malekal.com/ntuser-dat-fichier-systeme-utilisateur-windows'
]);

const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (compatible; LibrenardLinkCheck/1.0; +https://librenard.fr)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
};

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
        const relTarget = path.relative(rootDir, target).replaceAll(path.sep, '/');
        if (relTarget.startsWith('wiki/') || relTarget.startsWith('images/wiki/')) {
            const wikiExists = await exists(path.join(rootDir, 'wiki'));
            if (!wikiExists) {
                return null;
            }
        }
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

function externalUrlKey(value) {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    const path = url.pathname.replace(/\/$/, '') || '';
    return `${url.origin}${path}`.toLowerCase();
}

async function drainResponse(response) {
    try {
        await response.body?.cancel?.();
    } catch (_) {
        // Corps deja consomme ou annulation impossible : on ignore.
    }
}

async function checkRemoteLink(link) {
    if (externalAllowlist.has(externalUrlKey(link.value))) {
        console.log(`Lien externe en liste blanche (anti-bot) : ${link.value}`);
        return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const fetchOpts = {
        redirect: 'follow',
        signal: controller.signal,
        headers: browserHeaders
    };

    try {
        let response = await fetch(link.value, { ...fetchOpts, method: 'HEAD' });

        if ([403, 404, 405].includes(response.status)) {
            await drainResponse(response);
            response = await fetch(link.value, { ...fetchOpts, method: 'GET' });
        }

        const failureStatus = response.status;
        await drainResponse(response);

        if (failureStatus >= 400) {
            return `HTTP ${failureStatus}: ${relative(link.filePath)} -> ${link.value}`;
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
