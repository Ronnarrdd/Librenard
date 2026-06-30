// Rendu des trois vues principales du wiki (liste, livre, article)
// + composants de rendu partages (carte de livre, fil d'Ariane, ecran de chargement).

import { getBookBySlug, getPage, getVisibleBooks, flattenPages } from './api.js';
import { escapeHtml, formatRelativeDate, rewriteWikiLinks } from './helpers.js';
import { canonicalUrl, updateMeta, resetMeta, stripHtmlToText, DEFAULT_META } from './meta.js';
import {
    highlightArticleCode,
    buildToc,
    setupHeadingAnchors,
    renderTocSidebar,
    setupTocObserver,
    disconnectTocObserver,
    computeBookReadingMinutes,
    startReadingProgress
} from './article.js';
import { setupImageLightbox } from './lightbox.js';

// ---------- COMPOSANTS PARTAGES ----------

export function bookCardHtml(book) {
    const hasCover = book.cover && book.cover.url;
    const coverStyle = hasCover ? `style="background-image: url('${escapeHtml(book.cover.url)}')"` : '';
    const coverClass = hasCover ? 'book-card-cover' : 'book-card-cover book-card-cover-empty';
    const description = book.description
        ? `<p class="book-card-description">${escapeHtml(book.description)}</p>`
        : '';
    return `
        <a class="book-card" href="#/book/${encodeURIComponent(book.slug)}">
            <div class="${coverClass}" ${coverStyle} aria-hidden="true">
                ${hasCover ? '' : `
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20"/>
                        <path d="M8 7h8"/>
                        <path d="M8 11h6"/>
                    </svg>
                `}
            </div>
            <div class="book-card-body">
                <h2 class="book-card-title">${escapeHtml(book.name)}</h2>
                ${description}
                <div class="book-card-footer">
                    <span class="book-card-meta">Mis à jour ${formatRelativeDate(book.updated_at)}</span>
                    <span class="book-card-arrow" aria-hidden="true">→</span>
                </div>
            </div>
        </a>
    `;
}

export function renderBreadcrumb(items) {
    const el = document.getElementById('wiki-breadcrumb');
    if (!el) return;
    const parts = [{ text: 'Wiki', href: '#/' }, ...items];
    el.innerHTML = parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        if (isLast || !p.href) {
            return `<span class="wiki-bc-current">${escapeHtml(p.text)}</span>`;
        }
        return `<a href="${p.href}" class="wiki-bc-link">${escapeHtml(p.text)}</a><span class="wiki-bc-sep" aria-hidden="true">›</span>`;
    }).join('');
}

export function renderLoading(view) {
    view.innerHTML = `
        <div class="wiki-loading" role="status" aria-live="polite">
            <div class="wiki-loading-spinner" aria-hidden="true"></div>
            <p>Chargement…</p>
        </div>
    `;
}

// ---------- VUES ----------

export async function viewList(view) {
    const shelfSlug = view.dataset.shelf || null;
    const books = await getVisibleBooks(shelfSlug);
    if (!books.length) {
        view.innerHTML = `<p class="wiki-empty">Aucun livre pour le moment.</p>`;
        renderBreadcrumb([]);
        resetMeta();
        return;
    }
    view.innerHTML = `<div class="books-grid">${books.map(bookCardHtml).join('')}</div>`;
    renderBreadcrumb([]);
    // Vue racine : on revient aux meta par defaut de wiki.html
    resetMeta();
}

export async function viewBook(view, slug) {
    const book = await getBookBySlug(slug);
    const contents = book.contents || [];

    const hasCover = book.cover && book.cover.url;
    const coverHtml = hasCover
        ? `<img class="wiki-book-cover" src="${escapeHtml(book.cover.url)}" alt="" aria-hidden="true">`
        : `<div class="wiki-book-cover wiki-book-cover-empty" aria-hidden="true">
             <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20"/>
                 <path d="M8 7h8"/>
                 <path d="M8 11h6"/>
             </svg>
           </div>`;

    const tocHtml = contents.map(item => {
        if (item.type === 'chapter') {
            const pages = (item.pages || []).map(p => `
                <li><a href="#/book/${encodeURIComponent(book.slug)}/page/${encodeURIComponent(p.slug)}">${escapeHtml(p.name)}</a></li>
            `).join('');
            return `
                <section class="wiki-toc-chapter">
                    <h3 class="wiki-toc-chapter-title">${escapeHtml(item.name)}</h3>
                    ${item.description ? `<p class="wiki-toc-chapter-desc">${escapeHtml(item.description)}</p>` : ''}
                    <ul class="wiki-toc-list">${pages}</ul>
                </section>
            `;
        }
        return `
            <ul class="wiki-toc-list wiki-toc-orphan">
                <li><a href="#/book/${encodeURIComponent(book.slug)}/page/${encodeURIComponent(item.slug)}">${escapeHtml(item.name)}</a></li>
            </ul>
        `;
    }).join('');

    const emptyHtml = contents.length ? '' : '<p class="wiki-empty">Ce livre n\'a pas encore de contenu.</p>';

    const flatPages = flattenPages(book);
    const pageCount = flatPages.length;
    const pagesLabel = pageCount > 0
        ? `${pageCount} page${pageCount > 1 ? 's' : ''}`
        : '';

    view.innerHTML = `
        <article class="wiki-book-detail">
            <header class="wiki-book-header">
                ${coverHtml}
                <div class="wiki-book-meta">
                    <h1>${escapeHtml(book.name)}</h1>
                    ${book.description ? `<p class="wiki-book-description">${escapeHtml(book.description)}</p>` : ''}
                    <p class="wiki-book-updated">Mis à jour ${formatRelativeDate(book.updated_at)}</p>
                    ${pageCount > 0 ? `
                        <div class="wiki-book-stats">
                            <span class="wiki-book-stat"><span class="wiki-book-stat-icon" aria-hidden="true">📚</span>${pagesLabel}</span>
                            <span class="wiki-reading-time" id="wiki-book-reading-time" data-loading="true">calcul du temps de lecture…</span>
                        </div>
                    ` : ''}
                </div>
            </header>
            ${contents.length ? '<h2 class="wiki-toc-title">Sommaire</h2>' : ''}
            <div class="wiki-toc">${tocHtml}${emptyHtml}</div>
        </article>
    `;
    renderBreadcrumb([{ text: book.name }]);

    // Meta dynamiques pour la page livre
    updateMeta({
        title:       `${book.name} — Wiki Librenard`,
        description: book.description || DEFAULT_META.description,
        url:         canonicalUrl(),
        image:       (book.cover && book.cover.url) || DEFAULT_META.ogImage,
        type:        'website'
    });

    // Calcul du temps de lecture en tache de fond, sans bloquer l'affichage
    if (pageCount > 0) {
        const rtEl = view.querySelector('#wiki-book-reading-time');
        computeBookReadingMinutes(book).then(({ minutes }) => {
            // Si l'utilisateur a change de vue entretemps, ne rien mettre a jour
            if (!rtEl || !rtEl.isConnected) return;
            rtEl.textContent = `~${minutes} min de lecture`;
            delete rtEl.dataset.loading;
        }).catch(err => {
            console.warn('[wiki] calcul du temps de lecture :', err);
            if (rtEl && rtEl.isConnected) rtEl.remove();
        });
    }
}

export async function viewPage(view, bookSlug, pageSlug, sectionSlug = null) {
    const book = await getBookBySlug(bookSlug);
    const pageRef = flattenPages(book).find(p => p.slug === pageSlug);
    if (!pageRef) {
        view.innerHTML = `<p class="wiki-empty">Page introuvable dans ce livre.</p>`;
        renderBreadcrumb([{ text: book.name, href: `#/book/${book.slug}` }, { text: 'Page introuvable' }]);
        return;
    }
    const page = await getPage(pageRef.id);
    const html = rewriteWikiLinks(page.html || '');

    const all = flattenPages(book);
    const idx = all.findIndex(p => p.slug === pageSlug);
    const prev = idx > 0 ? all[idx - 1] : null;
    const next = idx < all.length - 1 ? all[idx + 1] : null;

    const navHtml = (prev || next) ? `
        <nav class="wiki-article-nav" aria-label="Navigation entre articles">
            ${prev
                ? `<a href="#/book/${encodeURIComponent(book.slug)}/page/${encodeURIComponent(prev.slug)}" class="wiki-nav-link wiki-nav-prev">
                       <span class="wiki-nav-dir">← Précédent</span>
                       <span class="wiki-nav-title">${escapeHtml(prev.name)}</span>
                   </a>`
                : '<span></span>'}
            ${next
                ? `<a href="#/book/${encodeURIComponent(book.slug)}/page/${encodeURIComponent(next.slug)}" class="wiki-nav-link wiki-nav-next">
                       <span class="wiki-nav-dir">Suivant →</span>
                       <span class="wiki-nav-title">${escapeHtml(next.name)}</span>
                   </a>`
                : '<span></span>'}
        </nav>
    ` : '';

    view.innerHTML = `
        <div class="wiki-article-layout">
            <div class="wiki-toc-slot" id="wiki-toc-slot"></div>
            <article class="wiki-article">
                <header class="wiki-article-header">
                    <h1>${escapeHtml(page.name)}</h1>
                    <p class="wiki-article-meta">Mis à jour ${formatRelativeDate(page.updated_at)}</p>
                </header>
                <div class="wiki-article-body">${html}</div>
                ${navHtml}
            </article>
        </div>
    `;

    // Construction de la TOC a partir du DOM rendu
    const articleBody = view.querySelector('.wiki-article-body');

    // Colorisation syntaxique des blocs de code (lazy-load : lib chargee a la
    // premiere rencontre d'un <pre><code>, pas sur la vue liste / sommaire).
    highlightArticleCode(articleBody);

    // Zoom des images (clic sur une image de l'article -> overlay plein ecran)
    setupImageLightbox(articleBody);

    // Barre de progression
    startReadingProgress(articleBody);

    const tocItems = buildToc(articleBody);
    const slot = view.querySelector('#wiki-toc-slot');
    if (slot && tocItems.length >= 2) {
        slot.innerHTML = renderTocSidebar(tocItems);
        setupTocObserver(tocItems, slot);
        view.querySelector('.wiki-article-layout')?.classList.add('has-toc');
    } else {
        disconnectTocObserver();
    }

    // Permaliennes "#" sur chaque titre h2/h3. Doit passer APRES buildToc qui
    // assigne les id. Utilise bookSlug/pageSlug pour fabriquer un lien deep-link.
    setupHeadingAnchors(articleBody, book.slug, page.slug);

    const bc = [{ text: book.name, href: `#/book/${book.slug}` }];
    if (pageRef.chapter) bc.push({ text: pageRef.chapter.name });
    bc.push({ text: page.name });
    renderBreadcrumb(bc);

    // Meta dynamiques : titre et description issus de l'article courant.
    // La description preferee est l'excerpt si Bookstack le fournit, sinon on
    // extrait ~200 caracteres du contenu HTML nettoye.
    const pageDescription = page.excerpt
        ? String(page.excerpt).replace(/\s+/g, ' ').trim().slice(0, 200)
        : stripHtmlToText(page.html, 200);
    updateMeta({
        title:       `${page.name} — ${book.name} | Wiki Librenard`,
        description: pageDescription || book.description || DEFAULT_META.description,
        url:         canonicalUrl(),
        image:       (book.cover && book.cover.url) || DEFAULT_META.ogImage,
        type:        'article'
    });

    // Scroll : vers la section si deep-link fourni et cible trouvee, sinon en haut.
    if (sectionSlug) {
        const target = articleBody.querySelector(`#${CSS.escape(sectionSlug)}`);
        if (target) {
            // Le layout peut encore bouger (images, TOC sidebar) : on attend une frame
            requestAnimationFrame(() => target.scrollIntoView({ behavior: 'auto', block: 'start' }));
            return;
        }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
}
