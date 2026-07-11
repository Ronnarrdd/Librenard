// Flux compact "Dernières modifications" affiche sur l'accueil (index.html).
//
// Source : /pages triees par -updated_at (et non /books). Le updated_at d'un
// livre Bookstack ne bouge pas quand une de ses pages est ajoutee ou editee :
// se baser sur les pages garantit que le flux reflete la vraie activite.

import { WIKI_CONFIG, getBooks, getRecentPages } from './api.js';
import { escapeHtml, formatRelativeDate } from './helpers.js';

function feedItemHtml(page, bookName) {
    const href = `wiki.html#/book/${encodeURIComponent(page.book_slug)}/page/${encodeURIComponent(page.slug)}`;
    const meta = [bookName, formatRelativeDate(page.updated_at)]
        .filter(Boolean)
        .map(escapeHtml)
        .join(' · ');
    return `
        <a class="wiki-feed-item" href="${href}">
            <div class="wiki-feed-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20"/>
                    <path d="M8 7h8"/>
                    <path d="M8 11h6"/>
                </svg>
            </div>
            <div class="wiki-feed-content">
                <div class="wiki-feed-title">${escapeHtml(page.name)}</div>
                <div class="wiki-feed-meta">${meta}</div>
            </div>
            <div class="wiki-feed-arrow" aria-hidden="true">→</div>
        </a>
    `;
}

function renderFeedItems(pages, bookNameById) {
    const list = document.getElementById('wiki-feed-list');
    if (!list) return;

    if (!pages.length) {
        document.getElementById('wiki-feed')?.classList.add('wiki-feed-hidden');
        return;
    }

    list.innerHTML = pages
        .map(page => feedItemHtml(page, bookNameById.get(page.book_id)))
        .join('');
}

export async function loadWikiFeed() {
    const section = document.getElementById('wiki-feed');
    if (!section) return;

    if (!WIKI_CONFIG.token) {
        section.classList.add('wiki-feed-hidden');
        return;
    }

    try {
        const shelfSlug = section.dataset.shelf || null;
        const [pages, books] = await Promise.all([
            getRecentPages(shelfSlug, WIKI_CONFIG.feedCount),
            getBooks()
        ]);
        const bookNameById = new Map(books.map(b => [b.id, b.name]));
        renderFeedItems(pages, bookNameById);
    } catch (err) {
        console.warn('[wiki-feed] Impossible de charger le flux :', err);
        section.classList.add('wiki-feed-hidden');
    }
}
