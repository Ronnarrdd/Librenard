// Puces de filtre par categorie sur les grilles de livres.
//
// Le markup (.wiki-filters + data-category sur les .book-card) est genere
// deux fois a l'identique : au build (scripts/build-site.mjs wikiGridHtml)
// et au runtime (js/wiki/views.js viewList). Ce module ne fait que le rendre
// interactif, par delegation globale : un seul listener, qui survit aux
// re-rendus du SPA.

import { escapeHtml, categoryFilters } from './helpers.js';

// HTML de la rangee de puces pour un jeu de livres (vide si moins de deux
// categories : filtrer n'aurait aucun sens).
export function filterChipsHtml(books, getCategory) {
    const filters = categoryFilters(books, getCategory);
    if (!filters.length) return '';
    return `
        <div class="wiki-filters" role="group" aria-label="Filtrer les livres par catégorie">
            <button type="button" class="wiki-filter-chip active" data-category="" aria-pressed="true">Tout</button>
            ${filters.map(f => `<button type="button" class="wiki-filter-chip" data-category="${f.key}" aria-pressed="false">${escapeHtml(f.label)}</button>`).join('')}
        </div>
    `;
}

function applyFilter(scope, chip) {
    scope.querySelectorAll('.wiki-filter-chip').forEach(c => {
        const active = c === chip;
        c.classList.toggle('active', active);
        c.setAttribute('aria-pressed', String(active));
    });

    const key = chip.dataset.category || '';
    scope.querySelectorAll('.book-card').forEach(card => {
        const show = !key || card.dataset.category === key;
        card.classList.toggle('filter-hidden', !show);
    });

    // Relance l'animation d'apparition des cartes visibles (le retrait puis
    // re-ajout de la classe force le navigateur a rejouer l'animation CSS).
    const grid = scope.querySelector('.books-grid');
    if (grid) {
        grid.classList.remove('filter-animate');
        void grid.offsetWidth;
        grid.classList.add('filter-animate');
    }
}

export function initWikiFilters() {
    document.addEventListener('click', (e) => {
        const chip = e.target.closest?.('.wiki-filter-chip');
        if (!chip) return;
        // Perimetre : la vue wiki qui contient la puce (wiki.html et
        // projets.html ont chacune leur #wiki-view).
        const scope = chip.closest('.wiki-view') || document;
        applyFilter(scope, chip);
    });
}
