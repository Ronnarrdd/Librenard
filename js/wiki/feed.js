// Flux compact "Derniers livres" affiche sur l'accueil (index.html).

import { WIKI_CONFIG, getVisibleBooks } from './api.js';
import { escapeHtml, formatRelativeDate } from './helpers.js';

function renderFeedItems(books) {
    const list = document.getElementById('wiki-feed-list');
    if (!list) return;

    if (!books.length) {
        document.getElementById('wiki-feed')?.classList.add('wiki-feed-hidden');
        return;
    }

    list.innerHTML = books.map(book => `
        <a class="wiki-feed-item" href="wiki.html#/book/${encodeURIComponent(book.slug)}">
            <div class="wiki-feed-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20"/>
                    <path d="M8 7h8"/>
                    <path d="M8 11h6"/>
                </svg>
            </div>
            <div class="wiki-feed-content">
                <div class="wiki-feed-title">${escapeHtml(book.name)}</div>
                <div class="wiki-feed-meta">${formatRelativeDate(book.updated_at)}</div>
            </div>
            <div class="wiki-feed-arrow" aria-hidden="true">→</div>
        </a>
    `).join('');
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
        const books = await getVisibleBooks(shelfSlug);
        renderFeedItems(books.slice(0, WIKI_CONFIG.feedCount));
    } catch (err) {
        console.warn('[wiki-feed] Impossible de charger le flux :', err);
        section.classList.add('wiki-feed-hidden');
    }
}
