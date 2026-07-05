// Recherche full-text dans le wiki via l'index Pagefind (genere au build).
// UI : champ #wiki-search-input + container de resultats #wiki-search-results.

import { escapeHtml, sanitizeInlineHtml } from './helpers.js';
import { pagefindModuleUrl, resolveSiteUrl } from './site-paths.js';

let pagefindModule = null;

async function loadPagefind() {
    if (pagefindModule) return pagefindModule;
    const url = pagefindModuleUrl();
    const mod = await import(/* webpackIgnore: true */ url);
    await mod.init();
    pagefindModule = mod;
    return mod;
}

function inferResultType(data) {
    const custom = data.meta?.['pagefind:type'];
    if (custom === 'Livre') return 'book';
    if (custom === 'Article') return 'page';
    const path = data.url || '';
    if (/\/wiki\/[^/]+\/[^/]+\.html/.test(path)) return 'page';
    if (/\/wiki\/[^/]+\.html/.test(path)) return 'book';
    return 'page';
}

async function searchWiki(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const pf = await loadPagefind();
    const response = await pf.search(q);
    const slice = (response.results || []).slice(0, 12);
    return Promise.all(slice.map(async (result) => {
        const data = await result.data();
        const title = data.meta?.title || data.meta?.['og:title'] || 'Sans titre';
        return {
            name: title,
            type: inferResultType(data),
            url: resolveSiteUrl(data.url),
            preview_html: {
                name: title,
                content: data.excerpt || ''
            }
        };
    }));
}

function searchResultIcon(type) {
    if (type === 'page') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`;
    }
    if (type === 'chapter') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`;
}

function searchResultTypeLabel(type) {
    if (type === 'page') return 'Article';
    if (type === 'chapter') return 'Chapitre';
    if (type === 'book') return 'Livre';
    return type || 'Contenu';
}

function renderSearchResults(container, items, query) {
    if (!items.length) {
        container.innerHTML = `<p class="wiki-search-empty">Aucun résultat pour « ${escapeHtml(query)} ».</p>`;
        container.hidden = false;
        return;
    }
    container.innerHTML = items.map((r, i) => {
        const rawSnippet = (r.preview_html && r.preview_html.content) || '';
        const safeSnippet = sanitizeInlineHtml(rawSnippet);
        const rawName = (r.preview_html && r.preview_html.name) || escapeHtml(r.name);
        const safeName = sanitizeInlineHtml(rawName);
        return `
            <a href="${escapeHtml(r.url)}" role="option" id="wiki-search-opt-${i}"
               class="wiki-search-result" data-index="${i}">
                <span class="wiki-search-result-icon" aria-hidden="true">${searchResultIcon(r.type)}</span>
                <span class="wiki-search-result-body">
                    <span class="wiki-search-result-title">${safeName}</span>
                    ${safeSnippet ? `<span class="wiki-search-result-snippet">${safeSnippet}</span>` : ''}
                </span>
                <span class="wiki-search-result-type">${searchResultTypeLabel(r.type)}</span>
            </a>
        `;
    }).join('');
    container.hidden = false;
}

export function initWikiSearch() {
    const input   = document.getElementById('wiki-search-input');
    const results = document.getElementById('wiki-search-results');
    if (!input || !results) return;

    let debounceId  = null;
    let requestSeq  = 0;
    let selected    = -1;

    function setExpanded(on) {
        input.setAttribute('aria-expanded', String(on));
    }

    function updateSelection() {
        const items = results.querySelectorAll('.wiki-search-result');
        items.forEach((el, i) => el.classList.toggle('active', i === selected));
        if (selected >= 0 && items[selected]) {
            items[selected].scrollIntoView({ block: 'nearest' });
            input.setAttribute('aria-activedescendant', items[selected].id);
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    }

    function closeResults() {
        results.hidden = true;
        setExpanded(false);
        selected = -1;
        updateSelection();
    }

    async function runSearch(q) {
        const myReq = ++requestSeq;
        results.innerHTML = '<p class="wiki-search-loading">Recherche…</p>';
        results.hidden = false;
        setExpanded(true);
        try {
            const items = await searchWiki(q);
            if (myReq !== requestSeq) return;
            selected = items.length ? 0 : -1;
            renderSearchResults(results, items, q);
            updateSelection();
        } catch (err) {
            if (myReq !== requestSeq) return;
            console.warn('[wiki-search]', err);
            results.innerHTML = `<p class="wiki-search-empty">Index de recherche indisponible. Lancez <code>npm run build</code> pour le générer.</p>`;
        }
    }

    input.addEventListener('input', () => {
        clearTimeout(debounceId);
        const q = input.value.trim();
        if (q.length < 2) {
            closeResults();
            return;
        }
        debounceId = setTimeout(() => runSearch(q), 200);
    });

    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2 && results.innerHTML) {
            results.hidden = false;
            setExpanded(true);
        }
    });

    input.addEventListener('keydown', (e) => {
        const items = results.querySelectorAll('.wiki-search-result');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!items.length) return;
            selected = (selected + 1) % items.length;
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!items.length) return;
            selected = (selected - 1 + items.length) % items.length;
            updateSelection();
        } else if (e.key === 'Enter') {
            if (selected >= 0 && items[selected]) {
                e.preventDefault();
                items[selected].click();
                input.blur();
                closeResults();
            }
        } else if (e.key === 'Escape') {
            closeResults();
            input.blur();
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            closeResults();
        }
    });

    results.addEventListener('click', () => {
        closeResults();
        input.blur();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target;
        const isField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (isField) return;
        e.preventDefault();
        input.focus();
        input.select();
    });
}
