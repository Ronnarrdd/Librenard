// Prerendu statique du wiki Bookstack.
//
// Ce module interroge l'API Bookstack au build et genere une page HTML
// statique par livre et par article :
//   wiki/<book-slug>.html            sommaire d'un livre
//   wiki/<book-slug>/<page-slug>.html  article
// Ces pages sont les URLs canoniques et partageables du contenu : elles
// portent les meta OpenGraph/Twitter (titre, description, couverture du
// livre) lisibles par les crawlers de preview des reseaux sociaux, la ou
// les anciennes routes hash (#/book/...) ne montraient que les meta
// generiques de wiki.html. js/wiki/main.js redirige ces routes ici.
//
// Le dossier wiki/ est entierement regenere a chaque build (supprime puis
// reecrit) : il ne doit contenir aucun fichier edite a la main.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { WIKI_CONFIG } from '../../js/wiki/api.js';
import { escapeHtml } from '../../js/wiki/helpers.js';
import { formatContent } from './format-html.mjs';
import { site, withBasePath, prefixFor, renderDocument, escapeAttr, renderWikiSearch } from './site-template.mjs';
import {
    bookOutputPath,
    articleOutputPath,
    stripHtmlText,
    wordCountFromHtml,
    readingMinutes,
    readingTimesManifest,
    formatDateFr,
    ensureHeadingIds,
    rewriteBookstackLinks
} from './wiki-static.mjs';
import { WikiImageMirror } from './wiki-images.mjs';

const API_TOKEN = process.env.BOOKSTACK_TOKEN || WIKI_CONFIG.token;
const UPLOADS_BASE = `${WIKI_CONFIG.baseUrl.replace(/\/$/, '')}/uploads`;
const MAX_CONCURRENT_FETCHES = 4;
const MAX_RETRIES = 3;

// ---------- ACCES API (avec pool de concurrence + retry sur 429) ----------

let activeFetches = 0;
const fetchQueue = [];

function acquireSlot() {
    if (activeFetches < MAX_CONCURRENT_FETCHES) {
        activeFetches++;
        return Promise.resolve();
    }
    return new Promise(resolve => fetchQueue.push(resolve));
}

function releaseSlot() {
    const next = fetchQueue.shift();
    if (next) next();
    else activeFetches--;
}

async function apiFetch(apiPath) {
    await acquireSlot();
    try {
        for (let attempt = 1; ; attempt++) {
            const res = await fetch(`${WIKI_CONFIG.apiBase}${apiPath}`, {
                headers: { Authorization: `Token ${API_TOKEN}` }
            });
            if (res.status === 429 && attempt <= MAX_RETRIES) {
                const wait = Number(res.headers.get('retry-after')) || 15;
                console.warn(`  API 429 sur ${apiPath}, nouvel essai dans ${wait}s (${attempt}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, wait * 1000));
                continue;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status} sur ${WIKI_CONFIG.apiBase}${apiPath}`);
            return res.json();
        }
    } finally {
        releaseSlot();
    }
}

// ---------- COLLECTE ----------

// Recupere les livres publies (etageres site.wikiShelves) avec le detail de
// leur contenu et le HTML de chaque page, tries par derniere mise a jour
// (meme ordre que la grille re-rendue au runtime par js/wiki/api.js getBooks).
// Retourne { books, booksByShelf } ; chaque livre porte shelfRef (label +
// pageHref de la page du site qui liste son etagere), pour le fil d'Ariane.
export async function fetchWikiContent() {
    const [shelves, booksJson] = await Promise.all([
        apiFetch('/shelves?count=100'),
        apiFetch('/books?count=200&sort=-updated_at')
    ]);
    const allBooks = booksJson.data || [];

    const booksByShelf = {};
    const books = [];
    const seen = new Set();

    for (const shelfConf of site.wikiShelves) {
        const shelfMeta = (shelves.data || []).find(s => s.slug === shelfConf.slug);
        if (!shelfMeta) throw new Error(`Étagère introuvable : ${shelfConf.slug}`);
        const shelfDetail = await apiFetch(`/shelves/${shelfMeta.id}`);
        const shelfBookIds = new Set((shelfDetail.books || []).map(b => b.id));

        const shelfBooks = allBooks.filter(b => shelfBookIds.has(b.id));
        booksByShelf[shelfConf.slug] = shelfBooks;

        for (const book of shelfBooks) {
            if (seen.has(book.id)) continue;
            seen.add(book.id);
            book.shelfRef = { label: shelfConf.label, pageHref: shelfConf.pageHref };
            books.push(book);
        }
    }

    await Promise.all(books.map(async book => {
        const detail = await apiFetch(`/books/${book.id}`);
        Object.assign(book, detail);

        // Aplatit livre -> [pages], en gardant la reference du chapitre.
        const flat = [];
        (book.contents || []).forEach(item => {
            if (item.type === 'page') flat.push({ ...item, chapter: null });
            else if (item.type === 'chapter') {
                (item.pages || []).forEach(p => flat.push({ ...p, chapter: item }));
            }
        });
        // Les brouillons ne sont pas publies en statique.
        book.flatPages = flat.filter(p => !p.draft);

        await Promise.all(book.flatPages.map(async ref => {
            ref.detail = await apiFetch(`/pages/${ref.id}`);
        }));
    }));

    return { books, booksByShelf };
}

// ---------- RENDU ----------

function relHref(fromOutput, toOutput) {
    const rel = path.posix.relative(path.posix.dirname(fromOutput), toOutput);
    return rel || '.';
}

function canonicalFor(output) {
    return `${site.url}${withBasePath(`/${output}`)}`;
}

function linkResolvers(books, fromOutput) {
    const bookBySlug = new Map(books.map(b => [b.slug, b]));
    return {
        wikiBaseUrl: WIKI_CONFIG.baseUrl,
        resolvePage: (bookSlug, pageSlug) => {
            const book = bookBySlug.get(bookSlug);
            if (!book || !book.flatPages.some(p => p.slug === pageSlug)) return null;
            return relHref(fromOutput, articleOutputPath(bookSlug, pageSlug));
        },
        resolveBook: (bookSlug) => {
            if (!bookBySlug.has(bookSlug)) return null;
            return relHref(fromOutput, bookOutputPath(bookSlug));
        }
    };
}

function breadcrumbHtml(prefix, shelfRef, items) {
    const parts = [{ text: shelfRef.label, href: `${prefix}${shelfRef.pageHref}` }, ...items];
    const inner = parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        if (isLast || !p.href) {
            return `<span class="wiki-bc-current">${escapeHtml(p.text)}</span>`;
        }
        return `<a href="${p.href}" class="wiki-bc-link">${escapeHtml(p.text)}</a><span class="wiki-bc-sep" aria-hidden="true">›</span>`;
    }).join('');
    return `<nav class="wiki-breadcrumb" aria-label="Fil d'Ariane">${inner}</nav>`;
}

const EMPTY_COVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h8"/><path d="M8 11h6"/></svg>`;

// Table des matieres laterale rendue au build. href encode pour que la
// navigation par ancre native (sans JS) retombe sur l'id literal, y compris
// les ids Bookstack contenant "%".
function tocSidebarHtml(allHeadings) {
    // Les titres vides (artefacts d'edition Bookstack) n'ont rien a faire dans la TOC.
    const headings = allHeadings.filter(h => h.text);
    if (headings.length < 2) return '';
    const links = headings.map(h => `
                <li class="wiki-toc-side-item wiki-toc-side-level-${h.level}">
                    <a href="#${encodeURIComponent(h.id)}" data-toc-link="${escapeAttr(h.id)}">${escapeHtml(h.text)}</a>
                </li>`).join('');
    return `
            <aside class="wiki-toc-sidebar" aria-label="Table des matières">
                <p class="wiki-toc-side-title">Sur cette page</p>
                <ul class="wiki-toc-side-list">${links}
                </ul>
            </aside>`;
}

function renderArticleDocument(books, book, ref, prevRef, nextRef) {
    const output = articleOutputPath(book.slug, ref.slug);
    const prefix = prefixFor(output);
    const page = ref.detail;

    const { html: bodyHtml, headings } = ensureHeadingIds(
        rewriteBookstackLinks(page.html || '', linkResolvers(books, output))
    );

    const minutes = readingMinutes(wordCountFromHtml(bodyHtml));
    const updated = formatDateFr(page.updated_at);
    const description = stripHtmlText(page.html, 200) || book.description || site.description;

    const bcItems = [{ text: book.name, href: relHref(output, bookOutputPath(book.slug)) }];
    if (ref.chapter) bcItems.push({ text: ref.chapter.name });
    bcItems.push({ text: page.name });
    const breadcrumb = breadcrumbHtml(prefix, book.shelfRef, bcItems);

    const navLink = (r, cls, dir) => `
            <a href="${relHref(output, articleOutputPath(book.slug, r.slug))}" class="wiki-nav-link ${cls}">
                <span class="wiki-nav-dir">${dir}</span>
                <span class="wiki-nav-title">${escapeHtml(r.name)}</span>
            </a>`;
    const navHtml = (prevRef || nextRef) ? `
        <nav class="wiki-article-nav" aria-label="Navigation entre articles">
            ${prevRef ? navLink(prevRef, 'wiki-nav-prev', '← Précédent') : '<span></span>'}
            ${nextRef ? navLink(nextRef, 'wiki-nav-next', 'Suivant →') : '<span></span>'}
        </nav>` : '';

    const toc = tocSidebarHtml(headings);
    const content = `        ${breadcrumb}

        ${renderWikiSearch()}

        <div class="wiki-article-layout${toc ? ' has-toc' : ''}">
            <div class="wiki-toc-slot" id="wiki-toc-slot">${toc}</div>
            <article class="wiki-article">
                <header class="wiki-article-header">
                    <h1>${escapeHtml(page.name)}</h1>
                    <p class="wiki-article-meta">Mis à jour le <time datetime="${escapeAttr(String(page.updated_at).slice(0, 10))}">${updated}</time> · ~${minutes} min de lecture</p>
                </header>
                <div class="wiki-article-body">
${bodyHtml}
                </div>${navHtml}
            </article>
        </div>`;

    const canonical = canonicalFor(output);
    return {
        output,
        html: renderDocument({
            page: {
                navKey: 'wiki',
                title: `${page.name} — ${book.name} | Wiki Librenard`,
                description,
                canonicalUrl: canonical,
                ogType: 'article',
                ogImage: book.cover?.url || site.ogImage,
                pagefindType: 'Article',
                pagefindBook: book.name,
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': 'TechArticle',
                    headline: page.name,
                    description,
                    inLanguage: 'fr',
                    isPartOf: { '@type': 'CreativeWork', name: `${book.name} — Wiki Librenard` },
                    datePublished: page.created_at,
                    dateModified: page.updated_at,
                    author: { '@type': 'Person', name: site.author },
                    image: book.cover?.url || site.ogImage,
                    mainEntityOfPage: canonical
                },
                scripts: [
                    { src: 'js/script.js' },
                    { type: 'module', src: 'js/wiki/static-article.js' }
                ]
            },
            prefix,
            content,
            generatorComment: 'Generated by scripts/build-site.mjs (prerendu wiki). Ne pas editer : regenere a chaque build.',
            indentContent: false
        }),
        lastmod: String(page.updated_at).slice(0, 10)
    };
}

function renderBookDocument(books, book) {
    const output = bookOutputPath(book.slug);
    const prefix = prefixFor(output);

    const coverHtml = book.cover?.url
        ? `<img class="wiki-book-cover" src="${escapeAttr(book.cover.url)}" alt="" aria-hidden="true">`
        : `<div class="wiki-book-cover wiki-book-cover-empty" aria-hidden="true">${EMPTY_COVER_SVG}</div>`;

    const pageLink = (p) => `<li><a href="${relHref(output, articleOutputPath(book.slug, p.slug))}">${escapeHtml(p.name)}</a></li>`;
    const tocHtml = (book.contents || []).map(item => {
        if (item.type === 'chapter') {
            const pages = (item.pages || []).filter(p => !p.draft).map(pageLink).join('\n                    ');
            return `
                <section class="wiki-toc-chapter">
                    <h3 class="wiki-toc-chapter-title">${escapeHtml(item.name)}</h3>
                    ${item.description ? `<p class="wiki-toc-chapter-desc">${escapeHtml(item.description)}</p>` : ''}
                    <ul class="wiki-toc-list">${pages}</ul>
                </section>`;
        }
        if (item.draft) return '';
        return `
                <ul class="wiki-toc-list wiki-toc-orphan">${pageLink(item)}</ul>`;
    }).join('');

    const pageCount = book.flatPages.length;
    // book.readingMinutes est calcule dans prerenderWiki (readingTimesManifest),
    // meme valeur que les cartes et le manifest JSON du SPA.
    const statsHtml = pageCount > 0 ? `
                    <div class="wiki-book-stats">
                        <span class="wiki-book-stat"><span class="wiki-book-stat-icon" aria-hidden="true">📚</span>${pageCount} page${pageCount > 1 ? 's' : ''}</span>
                        <span class="wiki-reading-time">~${book.readingMinutes} min de lecture</span>
                    </div>` : '';

    const content = `${breadcrumbHtml(prefix, book.shelfRef, [{ text: book.name }])}

        ${renderWikiSearch()}

<article class="wiki-book-detail">
    <header class="wiki-book-header">
        ${coverHtml}
        <div class="wiki-book-meta">
            <h1>${escapeHtml(book.name)}</h1>
            ${book.description ? `<p class="wiki-book-description">${escapeHtml(book.description)}</p>` : ''}
            <p class="wiki-book-updated">Mis à jour le <time datetime="${escapeAttr(String(book.updated_at).slice(0, 10))}">${formatDateFr(book.updated_at)}</time></p>${statsHtml}
    </div>
    </header>
    ${pageCount > 0 ? '<h2 class="wiki-toc-title">Sommaire</h2>' : ''}
    <div class="wiki-toc">${tocHtml}${pageCount ? '' : '<p class="wiki-empty">Ce livre n\'a pas encore de contenu.</p>'}</div>
</article>`;

    const description = book.description
        ? String(book.description)
        : `${book.name} — tutoriels et notes techniques sur le wiki Librenard.`;

    return {
        output,
        html: renderDocument({
            page: {
                navKey: 'wiki',
                title: `${book.name} — Wiki Librenard`,
                description,
                canonicalUrl: canonicalFor(output),
                ogImage: book.cover?.url || site.ogImage,
                pagefindType: 'Livre',
                scripts: [
                    { src: 'js/script.js' },
                    { type: 'module', src: 'js/wiki/static-wiki.js' }
                ]
            },
            prefix,
            // Pas de <pre> dans un sommaire : on peut reindenter proprement.
            content: formatContent(content),
            generatorComment: 'Generated by scripts/build-site.mjs (prerendu wiki). Ne pas editer : regenere a chaque build.'
        }),
        lastmod: String(book.updated_at).slice(0, 10)
    };
}

// Carte de livre pour la grille statique injectee dans wiki.html.
// Meme structure/classes que bookCardHtml (js/wiki/views.js), avec un lien
// reel vers la page statique et une date absolue (pas de date relative au build).
export function bookCardStaticHtml(book) {
    const hasCover = Boolean(book.cover?.url);
    const coverStyle = hasCover ? ` style="background-image: url('${escapeAttr(book.cover.url)}')"` : '';
    const coverClass = hasCover ? 'book-card-cover' : 'book-card-cover book-card-cover-empty';
    const description = book.description
        ? `<p class="book-card-description">${escapeHtml(book.description)}</p>`
        : '';
    const emptySvg = hasCover ? '' : `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h8"/><path d="M8 11h6"/></svg>`;
    // Hors du .book-card-cover (aria-hidden) pour rester lisible aux lecteurs d'ecran.
    const readingBadge = book.readingMinutes
        ? `<span class="book-card-reading-time" title="Temps de lecture estimé">~${book.readingMinutes} min<span class="sr-only"> de lecture</span></span>`
        : '';
    return `<a class="book-card" href="${bookOutputPath(book.slug)}">
    <div class="${coverClass}"${coverStyle} aria-hidden="true">${emptySvg}</div>${readingBadge ? `\n    ${readingBadge}` : ''}
    <div class="book-card-body">
        <h2 class="book-card-title">${escapeHtml(book.name)}</h2>
        ${description}
        <div class="book-card-footer">
            <span class="book-card-meta">Mis à jour le ${formatDateFr(book.updated_at)}</span>
            <span class="book-card-arrow" aria-hidden="true">→</span>
        </div>
    </div>
</a>`;
}

// ---------- ORCHESTRATION ----------

/**
 * Genere toutes les pages statiques du wiki dans <rootDir>/wiki/.
 * Retourne { booksByShelf, sitemapEntries } pour le sitemap et les grilles
 * statiques injectees dans wiki.html / projets.html.
 */
export async function prerenderWiki(rootDir) {
    const { books, booksByShelf } = await fetchWikiContent();
    const imageMirror = new WikiImageMirror(rootDir, UPLOADS_BASE, API_TOKEN);

    // Temps de lecture par livre, calcule une fois pour toutes les surfaces :
    // cartes statiques (book.readingMinutes) et SPA (wiki/reading-times.json).
    const readingTimes = readingTimesManifest(books);
    for (const book of books) {
        book.readingMinutes = readingTimes[book.slug] ?? null;
    }

    const documents = [];
    for (const book of books) {
        documents.push(renderBookDocument(books, book));
        book.flatPages.forEach((ref, i) => {
            const prev = i > 0 ? book.flatPages[i - 1] : null;
            const next = i < book.flatPages.length - 1 ? book.flatPages[i + 1] : null;
            documents.push(renderArticleDocument(books, book, ref, prev, next));
        });
    }

    console.log('Miroir des images BookStack…');
    for (const doc of documents) {
        doc.html = await imageMirror.processHtml(doc.html, doc.output);
    }

    for (const book of books) {
        if (book.cover?.url?.startsWith(UPLOADS_BASE)) {
            const mapped = imageMirror.cache.get(book.cover.url);
            if (mapped) {
                book.cover.url = imageMirror.absoluteSiteUrl(book.cover.url);
            }
        }
    }

    // Le dossier wiki/ est entierement possede par le build : on le vide pour
    // ne pas laisser trainer les pages d'articles supprimes ou renommes.
    const wikiDir = path.join(rootDir, 'wiki');
    await rm(wikiDir, { recursive: true, force: true });

    for (const doc of documents) {
        const filePath = path.join(rootDir, doc.output);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, doc.html, 'utf8');
    }

    const sitemapEntries = documents.map(doc => ({
        loc: canonicalFor(doc.output),
        lastmod: doc.lastmod,
        changefreq: 'monthly',
        priority: '0.7'
    }));

    // Manifest persiste pour que buildSitemap puisse inclure les URLs du wiki
    // meme lors d'un build --no-wiki (sans acces a l'API).
    await writeFile(
        path.join(wikiDir, 'sitemap-manifest.json'),
        `${JSON.stringify(sitemapEntries, null, 2)}\n`,
        'utf8'
    );

    // Temps de lecture par livre { slug: minutes }, consomme par le SPA
    // (js/wiki/api.js getReadingTimes) pour afficher le badge sur les cartes
    // sans avoir a re-fetcher le HTML de toutes les pages cote client.
    await writeFile(
        path.join(wikiDir, 'reading-times.json'),
        `${JSON.stringify(readingTimes, null, 2)}\n`,
        'utf8'
    );

    console.log(`Generated ${documents.length} pages wiki (${books.length} livres)`);
    return { booksByShelf, sitemapEntries };
}
