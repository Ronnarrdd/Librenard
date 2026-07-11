// Enhancement progressif des pages d'articles prerendues au build
// (wiki/<book-slug>/<page-slug>.html, generees par scripts/lib/wiki-prerender.mjs).
//
// Le contenu et la table des matieres sont deja dans le HTML : ce module
// n'ajoute que le confort de lecture (colorisation syntaxique, bouton copier,
// zoom des images, barre de progression, surlignage TOC au scroll,
// permaliennes sur les titres). Sans JS, la page reste lisible et navigable.

import { highlightArticleCode, startReadingProgress, buildToc, setupTocObserver, setupHeadingAnchors } from './article.js';
import { setupImageLightbox } from './lightbox.js';
import { initDyslexicMode } from './dyslexic.js';
import { initWikiSearch } from './search.js';

function init() {
    const articleBody = document.querySelector('.wiki-article-body');
    if (!articleBody) return;

    initDyslexicMode();
    initWikiSearch();
    highlightArticleCode(articleBody);
    setupImageLightbox(articleBody);
    startReadingProgress(articleBody);

    // La sidebar TOC est deja rendue : on ne fait que brancher l'observer
    // de scroll et le smooth-scroll sur les liens existants.
    const slot = document.getElementById('wiki-toc-slot');
    const items = buildToc(articleBody);
    if (slot && slot.querySelector('[data-toc-link]')) {
        setupTocObserver(items, slot);
    }

    // Permaliennes "#" sur les h2/h3. APRES buildToc (ids garantis, et le "#"
    // ne se retrouve pas dans les libelles de la TOC laterale).
    setupHeadingAnchors(articleBody);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
