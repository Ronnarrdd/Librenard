// Wiki Librenard - mini-SPA
// -----------------------------------------------------------------
// Navigation interne (flux d'accueil, cartes, hash #/book/...) : contenu
// charge en direct depuis l'API BookStack a chaque visite.
// Les pages statiques wiki/<livre>[/<article>].html (generees au build)
// restent les URL de partage avec les bonnes meta OpenGraph pour les reseaux
// sociaux ; la recherche Pagefind et le sitemap pointent aussi dessus.
// -----------------------------------------------------------------

import { WIKI_CONFIG, cache, getBookBySlug, getPage, flattenPages } from './api.js';
import { escapeHtml } from './helpers.js';
import { snapshotDefaultMeta } from './meta.js';
import { initDyslexicMode } from './dyslexic.js';
import { initWikiSearch } from './search.js';
import { initWikiFilters } from './filters.js';
import { loadWikiFeed } from './feed.js';
import { renderLoading, viewList, viewBook, viewPage } from './views.js';
import { stopReadingProgress, disconnectTocObserver } from './article.js';

// ---------- ROUTEUR ----------

function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { name: 'list' };
    const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'book' && parts[1]) {
        if (parts[2] === 'page' && parts[3]) {
            // Suffixe optionnel : /h/<sectionId> pour deep-link vers une section.
            // Retrocompatible : les URLs existantes (sans /h/...) fonctionnent a l'identique.
            const sectionSlug = (parts[4] === 'h' && parts[5]) ? parts[5] : null;
            return { name: 'page', bookSlug: parts[1], pageSlug: parts[3], sectionSlug };
        }
        return { name: 'book', bookSlug: parts[1] };
    }
    return { name: 'list' };
}

async function router() {
    const view = document.getElementById('wiki-view');
    if (!view) return;

    if (!WIKI_CONFIG.token) {
        view.innerHTML = `
            <p class="wiki-empty">
                Le jeton API n'est pas configuré. Retrouvez le wiki sur
                <a href="${WIKI_CONFIG.baseUrl}" target="_blank" rel="noopener noreferrer">librenard.fr/wiki</a>.
            </p>`;
        return;
    }

    // Nettoyage de l'observer TOC avant de changer de vue
    disconnectTocObserver();

    // Coupe la barre de progression si on quitte un article
    stopReadingProgress();

    const state = parseHash();

    // La grille de livres est prerendue au build dans le HTML (SEO + no-JS).
    // Sur la vue liste, on la laisse affichee pendant le fetch au lieu d'un
    // ecran de chargement : pas de flash, et elle sert de repli si l'API tombe.
    const hasStaticGrid = Boolean(view.querySelector('.book-card:not(.book-card-skeleton)'));
    if (!(state.name === 'list' && hasStaticGrid)) {
        renderLoading(view);
    }

    // Elements a masquer en mode lecture (livre/article) : page-header, cartes, intros...
    // Convention : ajouter la classe .wiki-hide-in-view sur les elements concernes.
    const onList = state.name === 'list';
    document.querySelectorAll('.wiki-hide-in-view').forEach(el => {
        el.style.display = onList ? '' : 'none';
    });

    // Pas de fil d'Ariane sur la vue racine (juste "Wiki", redondant)
    const breadcrumb = document.getElementById('wiki-breadcrumb');
    if (breadcrumb) {
        breadcrumb.style.display = onList ? 'none' : '';
    }

    try {
        if (state.name === 'page') {
            await viewPage(view, state.bookSlug, state.pageSlug, state.sectionSlug);
        } else if (state.name === 'book') {
            await viewBook(view, state.bookSlug);
        } else {
            await viewList(view);
        }
    } catch (err) {
        console.error('[wiki]', err);
        if (state.name === 'list' && hasStaticGrid) {
            // La grille prerendue est toujours a l'ecran et ses liens (pages
            // statiques) fonctionnent sans l'API : on la garde telle quelle.
            return;
        }
        view.innerHTML = `
            <p class="wiki-empty">
                Oups, impossible de charger ce contenu&nbsp;: ${escapeHtml(err.message)}.<br>
                <a href="#/">← Retour à la liste des livres</a>
            </p>`;
    }
}

// ---------- PREFETCH (navigation SPA instantanee) ----------

// Declenche un prefetch de page ou de livre (via le cache existant) au bout
// d'un court delai de survol, pour que le clic suivant soit instantane.
// Delegation globale : un seul jeu de listeners pour toute l'application.
function setupPrefetch() {
    const PREFETCH_DELAY_MS = 120;
    const timers = new WeakMap();

    async function doPrefetch(bookSlug, pageSlug) {
        try {
            const book = await getBookBySlug(bookSlug);
            if (!pageSlug) return;
            const ref = flattenPages(book).find(p => p.slug === pageSlug);
            if (ref && !cache.pageById[ref.id]) {
                await getPage(ref.id);
            }
        } catch (_) {
            // Prefetch est best-effort : une erreur ne doit jamais remonter
        }
    }

    function parseWikiLink(link) {
        const href = link.getAttribute('href') || '';
        const m = href.match(/^#\/book\/([^/]+)(?:\/page\/([^/]+))?/);
        if (!m) return null;
        return {
            bookSlug: decodeURIComponent(m[1]),
            pageSlug: m[2] ? decodeURIComponent(m[2]) : null
        };
    }

    function schedulePrefetch(link) {
        if (!link || link.dataset.prefetched) return;
        const parsed = parseWikiLink(link);
        if (!parsed) return;
        const tid = setTimeout(() => {
            link.dataset.prefetched = '1';
            timers.delete(link);
            doPrefetch(parsed.bookSlug, parsed.pageSlug);
        }, PREFETCH_DELAY_MS);
        timers.set(link, tid);
    }

    function cancelPrefetch(link) {
        if (!link) return;
        const tid = timers.get(link);
        if (tid) {
            clearTimeout(tid);
            timers.delete(link);
        }
    }

    // mouseover bulle, contrairement a mouseenter : un seul listener global.
    // On filtre les liens SPA vers livre/page pour ne rien fetcher d'inutile.
    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest?.('a[href^="#/book/"]');
        if (link) schedulePrefetch(link);
    });
    document.addEventListener('mouseout', (e) => {
        const link = e.target.closest?.('a[href^="#/book/"]');
        if (link) cancelPrefetch(link);
    });
    // Sur mobile : le premier contact declenche, ~50 ms avant le click
    document.addEventListener('touchstart', (e) => {
        const link = e.target.closest?.('a[href^="#/book/"]');
        if (link) schedulePrefetch(link);
    }, { passive: true });
    // Accessibilite : le focus clavier declenche le prefetch aussi
    document.addEventListener('focusin', (e) => {
        const link = e.target.closest?.('a[href^="#/book/"]');
        if (link) schedulePrefetch(link);
    });
}

// ---------- INIT ----------

function init() {
    // Snapshot des meta initiales de wiki.html, AVANT toute mise a jour,
    // pour pouvoir y revenir sur la vue liste.
    snapshotDefaultMeta();
    initDyslexicMode();
    initWikiSearch();
    initWikiFilters();
    setupPrefetch();
    loadWikiFeed();
    router();
    window.addEventListener('hashchange', router);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
