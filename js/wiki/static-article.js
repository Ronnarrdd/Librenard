// Enhancement progressif des pages d'articles prerendues au build
// (wiki/<book-slug>/<page-slug>.html, generees par scripts/lib/wiki-prerender.mjs).
//
// Le contenu et la table des matieres sont deja dans le HTML : ce module
// n'ajoute que le confort de lecture du SPA (colorisation syntaxique, bouton
// copier, zoom des images, barre de progression, surlignage TOC au scroll).
// Sans JS, la page reste entierement lisible et navigable.

import { highlightArticleCode, startReadingProgress, buildToc, setupTocObserver } from './article.js';
import { setupImageLightbox } from './lightbox.js';
import { initDyslexicMode } from './dyslexic.js';

function init() {
    const articleBody = document.querySelector('.wiki-article-body');
    if (!articleBody) return;

    initDyslexicMode();
    highlightArticleCode(articleBody);
    setupImageLightbox(articleBody);
    startReadingProgress(articleBody);

    // La sidebar TOC est deja rendue : on ne fait que brancher l'observer
    // de scroll et le smooth-scroll sur les liens existants.
    const slot = document.getElementById('wiki-toc-slot');
    if (slot && slot.querySelector('[data-toc-link]')) {
        const items = buildToc(articleBody);
        setupTocObserver(items, slot);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
