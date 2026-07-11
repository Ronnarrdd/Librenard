// Wiki Librenard - point d'entree JS des pages listant les livres
// -----------------------------------------------------------------
// Depuis que la lecture (livre + article) vit sur les pages statiques
// prerendues (wiki/<livre>.html, wiki/<livre>/<article>.html), ce module :
//  - redirige les anciennes routes hash (#/book/...) vers ces pages statiques
//    (elles seules portent les meta OpenGraph lisibles par les crawlers) ;
//  - re-rend la grille de livres depuis l'API (dates relatives, contenu frais) ;
//  - initialise recherche, mode dyslexie, flux d'accueil et prefetch au survol.
//
// Surfaces gerees :
//  - Flux "Dernières modifications" sur index.html (#wiki-feed-list)
//  - Grille des livres sur wiki.html et projets.html (#wiki-view)
// -----------------------------------------------------------------

import { WIKI_CONFIG } from './api.js';
import { parseWikiHash, staticWikiPath } from './helpers.js';
import { initDyslexicMode } from './dyslexic.js';
import { initWikiSearch } from './search.js';
import { loadWikiFeed } from './feed.js';
import { viewList } from './views.js';

// ---------- REDIRECTION DES ROUTES HASH HERITEES ----------

// Les URLs #/book/<b>[/page/<p>[/h/<id>]] circulent encore (favoris, liens
// partages). On les redirige vers la page statique equivalente, qui porte
// titre, description et image du contenu pour les previews. location.replace
// pour ne pas laisser l'URL hash dans l'historique.
function redirectLegacyHash() {
    const state = parseWikiHash(location.hash);
    if (state.name === 'list') return false;
    const path = staticWikiPath(state.bookSlug, state.pageSlug, state.sectionSlug);
    location.replace(new URL(path, `${location.origin}${location.pathname}`).href);
    return true;
}

// ---------- GRILLE DES LIVRES ----------

async function renderGrid() {
    const view = document.getElementById('wiki-view');
    if (!view) return;

    if (!WIKI_CONFIG.token) {
        // La grille prerendue au build reste affichee : ses liens statiques
        // fonctionnent sans l'API. Rien a faire.
        return;
    }

    try {
        await viewList(view);
    } catch (err) {
        console.warn('[wiki] grille non rafraichie, on garde la version prerendue :', err);
    }
}

// ---------- PREFETCH DES PAGES STATIQUES ----------

// <link rel="prefetch"> a l'intention (survol, contact tactile, focus clavier)
// sur les liens internes vers wiki/ : le clic suivant est quasi instantane.
function setupPrefetch() {
    const prefetched = new Set();

    function prefetch(link) {
        const href = link?.getAttribute('href') || '';
        if (!/^wiki\/[^\s]+\.html/.test(href)) return;
        const url = new URL(href, document.baseURI).href;
        if (prefetched.has(url)) return;
        prefetched.add(url);
        const el = document.createElement('link');
        el.rel = 'prefetch';
        el.href = url;
        document.head.appendChild(el);
    }

    const handler = (e) => prefetch(e.target.closest?.('a[href^="wiki/"]'));
    document.addEventListener('mouseover', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('focusin', handler);
}

// ---------- INIT ----------

function init() {
    if (redirectLegacyHash()) return;
    initDyslexicMode();
    initWikiSearch();
    setupPrefetch();
    loadWikiFeed();
    renderGrid();
    // Un lien hash residuel clique apres le chargement passe aussi par la redirection.
    window.addEventListener('hashchange', redirectLegacyHash);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
