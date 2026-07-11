// Helpers purs (sans reseau ni DOM) pour le prerendu statique du wiki.
// Testes par wiki-static.test.mjs. Toute la logique deterministe du prerendu
// vit ici ; wiki-prerender.mjs ne fait que fetch + assemblage + ecriture.

import { slugify, escapeRegex } from '../../js/wiki/helpers.js';

export { slugify, escapeRegex };

// ---------- CHEMINS DES PAGES STATIQUES ----------
// Un livre  -> wiki/<book-slug>.html
// Une page  -> wiki/<book-slug>/<page-slug>.html

export function bookOutputPath(bookSlug) {
    return `wiki/${bookSlug}.html`;
}

export function articleOutputPath(bookSlug, pageSlug) {
    return `wiki/${bookSlug}/${pageSlug}.html`;
}

// ---------- TEXTE ----------

const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    nbsp: ' ', hellip: '…', laquo: '«', raquo: '»',
    eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ugrave: 'ù',
    rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c',
    ndash: '–', mdash: '—'
};

export function decodeEntities(text) {
    return String(text ?? '')
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

// Equivalent serveur de stripHtmlToText (js/wiki/meta.js) : texte brut d'un
// HTML Bookstack, compacte et tronque proprement a un mot entier.
export function stripHtmlText(html, maxLen = 200) {
    if (!html) return '';
    const text = decodeEntities(
        String(html)
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
    ).replace(/\s+/g, ' ').trim();
    if (text.length <= maxLen) return text;
    const truncated = text.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    const clean = (lastSpace > maxLen * 0.6) ? truncated.slice(0, lastSpace) : truncated;
    return clean.replace(/[.,;:!?\s]+$/, '') + '…';
}

export function wordCountFromHtml(html) {
    const text = stripHtmlText(html, Infinity);
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
}

// ~220 mots/min, meme convention que js/wiki/article.js
export function readingMinutes(words) {
    return Math.max(1, Math.round(words / 220));
}

// Manifeste { slug: minutes } des temps de lecture par livre, calcule au build
// a partir du HTML deja fetche (book.flatPages[].detail.html). Consomme par :
//  - bookCardStaticHtml (cartes de la grille prerendue)
//  - le SPA via wiki/reading-times.json (cartes re-rendues au runtime)
// Les livres sans page publiee sont omis : pas de badge plutot qu'un "~1 min" menteur.
export function readingTimesManifest(books) {
    const manifest = {};
    for (const book of books) {
        const pages = book.flatPages || [];
        if (!pages.length) continue;
        const words = pages.reduce((sum, p) => sum + wordCountFromHtml(p.detail?.html), 0);
        manifest[book.slug] = readingMinutes(words);
    }
    return manifest;
}

const MONTHS_FR = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

// Date absolue en francais ("22 avril 2026"). Les pages statiques ne peuvent
// pas afficher de date relative : elle serait fausse des le lendemain du build.
export function formatDateFr(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---------- IDENTIFIANTS DE SECTIONS ----------

// Garantit un id sur chaque h2/h3 du HTML d'article (pour ancres et TOC),
// en respectant les ids poses par Bookstack (bkmrk-...). Retourne le HTML
// modifie et la liste des sections pour construire une TOC.
export function ensureHeadingIds(html) {
    const used = new Set();
    for (const m of String(html).matchAll(/\sid\s*=\s*"([^"]+)"/g)) {
        used.add(m[1]);
    }

    const headings = [];
    const result = String(html).replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level, attrs, inner) => {
        const idMatch = attrs.match(/\sid\s*=\s*"([^"]+)"/);
        const text = stripHtmlText(inner, Infinity);
        let id = idMatch ? idMatch[1] : null;
        let tag = full;
        if (!id) {
            const base = slugify(text) || 'section';
            id = base;
            let n = 1;
            while (used.has(id)) id = `${base}-${n++}`;
            used.add(id);
            tag = `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
        }
        headings.push({ id, text, level: Number(level) });
        return tag;
    });

    return { html: result, headings };
}

// ---------- REECRITURE DES LIENS BOOKSTACK ----------

/**
 * Remplace les URLs Bookstack internes par les chemins des pages statiques.
 * Les cibles hors du perimetre publie (livre absent de l'etagere, chapitre...)
 * restent pointees vers Bookstack : le lien fonctionne toujours.
 *
 * @param {string} html HTML d'article Bookstack.
 * @param {object} opts
 * @param {string} opts.wikiBaseUrl URL racine de Bookstack (sans / final).
 * @param {(bookSlug: string, pageSlug: string) => string|null} opts.resolvePage
 *        Chemin statique relatif pour un article publie, sinon null.
 * @param {(bookSlug: string) => string|null} opts.resolveBook
 *        Chemin statique relatif pour un livre publie, sinon null.
 */
export function rewriteBookstackLinks(html, { wikiBaseUrl, resolvePage, resolveBook }) {
    const base = escapeRegex(wikiBaseUrl.replace(/\/$/, ''));

    let out = String(html).replace(
        new RegExp(`${base}/books/([\\w-]+)/page/([\\w-]+)`, 'g'),
        (full, b, p) => resolvePage(b, p) ?? full
    );
    out = out.replace(
        new RegExp(`${base}/books/([\\w-]+)/chapter/[\\w-]+`, 'g'),
        (full, b) => resolveBook(b) ?? full
    );
    out = out.replace(
        new RegExp(`${base}/books/([\\w-]+)(?![\\w/-])`, 'g'),
        (full, b) => resolveBook(b) ?? full
    );
    return out;
}
