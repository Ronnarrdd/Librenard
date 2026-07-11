// Rendu de la grille de livres (wiki.html, projets.html).
//
// La lecture (sommaire d'un livre, article) vit sur les pages statiques
// prerendues au build (scripts/lib/wiki-prerender.mjs) : les cartes pointent
// directement dessus. Le re-rendu de la grille au runtime n'apporte que la
// fraicheur (dates relatives, contenu ajoute depuis le dernier build).

import { getVisibleBooks, getReadingTimes } from './api.js';
import { escapeHtml, formatRelativeDate, staticWikiPath } from './helpers.js';

export function bookCardHtml(book, readingMinutes = null) {
    const hasCover = book.cover && book.cover.url;
    const coverStyle = hasCover ? `style="background-image: url('${escapeHtml(book.cover.url)}')"` : '';
    const coverClass = hasCover ? 'book-card-cover' : 'book-card-cover book-card-cover-empty';
    const description = book.description
        ? `<p class="book-card-description">${escapeHtml(book.description)}</p>`
        : '';
    // Hors du .book-card-cover (aria-hidden) pour rester lisible aux lecteurs d'ecran.
    const readingBadge = readingMinutes
        ? `<span class="book-card-reading-time" title="Temps de lecture estimé">~${readingMinutes} min<span class="sr-only"> de lecture</span></span>`
        : '';
    return `
        <a class="book-card" href="${staticWikiPath(book.slug)}">
            <div class="${coverClass}" ${coverStyle} aria-hidden="true">
                ${hasCover ? '' : `
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20"/>
                        <path d="M8 7h8"/>
                        <path d="M8 11h6"/>
                    </svg>
                `}
            </div>
            ${readingBadge}
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

export async function viewList(view) {
    const shelfSlug = view.dataset.shelf || null;
    // Temps de lecture precalcules au build (best-effort : {} si absent),
    // charges en parallele de la liste des livres.
    const [books, readingTimes] = await Promise.all([
        getVisibleBooks(shelfSlug),
        getReadingTimes()
    ]);
    if (!books.length) {
        view.innerHTML = `<p class="wiki-empty">Aucun livre pour le moment.</p>`;
        return;
    }
    view.innerHTML = `<div class="books-grid">${books.map(b => bookCardHtml(b, readingTimes[b.slug])).join('')}</div>`;
}
