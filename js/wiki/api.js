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
    booksBySlug: {},
    pageById: {},
    shelvesBySlug: {}
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
    cache.books.forEach(b => { cache.booksBySlug[b.slug] = b; });
    return cache.books;
}

export async function getBookBySlug(slug) {
    await getBooks();
    const book = cache.booksBySlug[slug];
    if (!book) throw new Error(`Livre introuvable : ${slug}`);
    if (!book.contents) {
        const detail = await apiFetch(`/books/${book.id}`);
        Object.assign(book, detail);
    }
    return book;
}

export async function getPage(pageId) {
    if (cache.pageById[pageId]) return cache.pageById[pageId];
    const page = await apiFetch(`/pages/${pageId}`);
    cache.pageById[pageId] = page;
    return page;
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

export function flattenPages(book) {
    const items = [];
    (book.contents || []).forEach(item => {
        if (item.type === 'page') {
            items.push({ ...item, chapter: null });
        } else if (item.type === 'chapter') {
            (item.pages || []).forEach(p => {
                items.push({ ...p, chapter: item });
            });
        }
    });
    return items;
}
