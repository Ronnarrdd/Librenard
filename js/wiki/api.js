// Configuration et acces a l'API Bookstack.
// Centralise le token, le cache memoire et les wrappers de fetch.

export const WIKI_CONFIG = {
    baseUrl:   'https://librenard.fr/wiki',
    apiBase:   'https://librenard.fr/wiki/api',
    token:     'cpGYdezdOIWNtGFrGmzDxRlzz3xMGCO4:5Nf95aG4sQ6Cl1R7MR1E2rO8nXddZDfk',
    feedCount: 4
};

export const cache = {
    books: null,
    shelvesBySlug: {},
    recentPages: null,
    readingTimes: null
};

export function apiFetch(path) {
    return fetch(`${WIKI_CONFIG.apiBase}${path}`, {
        // On n'envoie pas les cookies : l'authentification doit reposer
        // uniquement sur le token API. Sinon, dans un navigateur connecte a
        // BookStack, le cookie de session prime sur le token et provoque des
        // 401 intermittents (session expiree / CSRF).
        credentials: 'omit',
        headers: { 'Authorization': `Token ${WIKI_CONFIG.token}` }
    }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    });
}

export async function getBooks() {
    if (cache.books) return cache.books;
    const json = await apiFetch(`/books?count=200&sort=-updated_at`);
    cache.books = json.data || [];
    return cache.books;
}

export async function getShelfBookIds(shelfSlug) {
    if (cache.shelvesBySlug[shelfSlug]) return cache.shelvesBySlug[shelfSlug];
    const list = await apiFetch(`/shelves?count=100`);
    const meta = (list.data || []).find(s => s.slug === shelfSlug);
    if (!meta) throw new Error(`Étagère introuvable : ${shelfSlug}`);
    const shelf = await apiFetch(`/shelves/${meta.id}`);
    const bookIds = new Set((shelf.books || []).map(b => b.id));
    cache.shelvesBySlug[shelfSlug] = { shelf, bookIds };
    return cache.shelvesBySlug[shelfSlug];
}

// Retourne les livres visibles selon une eventuelle etagere (slug).
// Si shelfSlug est vide/null, retourne tous les livres.
export async function getVisibleBooks(shelfSlug) {
    const allBooks = await getBooks();
    if (!shelfSlug) return allBooks;
    const { bookIds } = await getShelfBookIds(shelfSlug);
    return allBooks.filter(b => bookIds.has(b.id));
}

// Selection pure des pages recentes : ecarte les brouillons, restreint aux
// livres visibles (visibleBookIds = Set d'ids, ou null pour tout garder)
// et coupe a `limit`. L'API renvoie deja les pages triees par -updated_at.
export function selectRecentPages(pages, visibleBookIds, limit) {
    return (pages || [])
        .filter(p => !p.draft)
        .filter(p => !visibleBookIds || visibleBookIds.has(p.book_id))
        .slice(0, limit);
}

// Dernieres pages modifiees du wiki, restreintes a une eventuelle etagere.
// Contrairement a getBooks(), le champ updated_at d'une page bouge des
// qu'elle est editee : c'est la vraie source des "dernieres modifications".
export async function getRecentPages(shelfSlug, limit) {
    if (!cache.recentPages) {
        const json = await apiFetch(`/pages?count=50&sort=-updated_at`);
        cache.recentPages = json.data || [];
    }
    let visibleBookIds = null;
    if (shelfSlug) {
        const { bookIds } = await getShelfBookIds(shelfSlug);
        visibleBookIds = bookIds;
    }
    return selectRecentPages(cache.recentPages, visibleBookIds, limit);
}

// Temps de lecture par livre { slug: minutes }, precalcule au build
// (scripts/lib/wiki-prerender.mjs ecrit wiki/reading-times.json). Best-effort :
// si le fichier manque (build --no-wiki, nouveau livre pas encore rebuild),
// retourne {} et les cartes s'affichent simplement sans badge.
export async function getReadingTimes() {
    if (cache.readingTimes) return cache.readingTimes;
    try {
        const res = await fetch(new URL('wiki/reading-times.json', document.baseURI));
        cache.readingTimes = res.ok ? await res.json() : {};
    } catch (_) {
        cache.readingTimes = {};
    }
    return cache.readingTimes;
}
