// Helpers purs (formatage, echappement, sanitation, slugify, routes wiki).

import { WIKI_CONFIG } from './api.js';

export function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Sanitation DOM : ne garde qu'une liste blanche de balises inline, supprime tous les attributs.
// Utilise <template> pour parser sans charger d'images ni executer de scripts.
const ALLOWED_INLINE_TAGS = new Set(['STRONG', 'EM', 'MARK', 'B', 'I']);

export function sanitizeInlineHtml(html) {
    const tmp = document.createElement('template');
    tmp.innerHTML = String(html ?? '');
    tmp.content.querySelectorAll('*').forEach(el => {
        if (!ALLOWED_INLINE_TAGS.has(el.tagName)) {
            el.replaceWith(...el.childNodes);
        } else {
            [...el.attributes].forEach(a => el.removeAttribute(a.name));
        }
    });
    return tmp.innerHTML;
}

export function formatRelativeDate(iso) {
    const date = new Date(iso);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "a l'instant";
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
    if (diff < 2592000) {
        const days = Math.floor(diff / 86400);
        return `il y a ${days} jour${days > 1 ? 's' : ''}`;
    }
    if (diff < 31536000) {
        const months = Math.floor(diff / 2592000);
        return `il y a ${months} mois`;
    }
    const years = Math.floor(diff / 31536000);
    return `il y a ${years} an${years > 1 ? 's' : ''}`;
}

// Chemin (relatif a la racine du site) de la page statique prerendue par
// scripts/lib/wiki-prerender.mjs pour un livre ou un article, avec ancre de
// section optionnelle. C'est l'URL canonique et partageable du contenu :
// les routes hash du SPA ne portent pas de meta OpenGraph pour les crawlers.
export function staticWikiPath(bookSlug, pageSlug = null, sectionId = null) {
    const path = pageSlug
        ? `wiki/${encodeURIComponent(bookSlug)}/${encodeURIComponent(pageSlug)}.html`
        : `wiki/${encodeURIComponent(bookSlug)}.html`;
    // Ancre encodee pour que la navigation native retombe sur l'id literal,
    // y compris les ids Bookstack contenant "%" (meme convention que la TOC
    // prerendue de wiki-prerender.mjs).
    return sectionId ? `${path}#${encodeURIComponent(sectionId)}` : path;
}

// Analyse une route hash du SPA. Formes reconnues :
//   #/                          -> { name: 'list' }
//   #/book/<b>                  -> { name: 'book', bookSlug }
//   #/book/<b>/page/<p>         -> { name: 'page', bookSlug, pageSlug }
//   #/book/<b>/page/<p>/h/<id>  -> idem + sectionSlug (deep-link de section)
// Toute route inconnue retombe sur la liste.
export function parseWikiHash(rawHash) {
    const raw = String(rawHash ?? '').replace(/^#\/?/, '');
    if (!raw) return { name: 'list' };
    const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'book' && parts[1]) {
        if (parts[2] === 'page' && parts[3]) {
            const sectionSlug = (parts[4] === 'h' && parts[5]) ? parts[5] : null;
            return { name: 'page', bookSlug: parts[1], pageSlug: parts[3], sectionSlug };
        }
        return { name: 'book', bookSlug: parts[1] };
    }
    return { name: 'list' };
}

export function slugify(text) {
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80) || 'section';
}

// ---------- CATEGORIES (tags Bookstack) ----------

// Ordre d'affichage preferentiel des categories connues. Ce n'est PAS un
// filtre : un tag inedit dans Bookstack cree sa propre section, affichee
// apres celles-ci en ordre alphabetique. Rien a modifier ici pour ajouter
// une categorie.
export const PREFERRED_CATEGORY_ORDER = [
    'Linux',
    'Windows',
    'Réseau',
    'Matériel & stockage',
    'Supervision',
    'Bidouilles'
];

// Groupe des livres sans tag, toujours affiche en dernier.
export const UNCATEGORIZED_LABEL = 'Autres';

// Categorie d'un livre = son premier tag Bookstack. Tolere les deux formats
// de tag : nom seul ("Linux") ou nom vide avec valeur (value = "Linux").
export function bookCategory(tags) {
    for (const tag of tags || []) {
        const label = String(tag?.name ?? '').trim() || String(tag?.value ?? '').trim();
        if (label) return label;
    }
    return null;
}

// Cle de filtre d'une categorie (attribut data-category des cartes et des
// puces) : slug stable, insensible a la casse et aux accents. Un livre sans
// categorie retombe sur la cle du groupe "Autres".
export function categoryKey(category) {
    return slugify(String(category ?? '').trim() || UNCATEGORIZED_LABEL);
}

// Liste des puces de filtre pour un jeu de livres : [{ key, label }] dans
// l'ordre d'affichage (preferentiel, puis nouvelles categories en
// alphabetique, puis "Autres"). Vide s'il y a moins de deux categories :
// filtrer n'aurait alors aucun sens, on n'affiche pas de puces.
export function categoryFilters(books, getCategory) {
    const groups = groupBooksByCategory(books, getCategory);
    if (groups.length < 2) return [];
    return groups.map(g => ({ key: categoryKey(g.category), label: g.category }));
}

// Regroupe des livres par categorie. getCategory(book) retourne le label
// (ou null/undefined -> groupe "Autres"). La cle de regroupement est
// normalisee via slugify : "Réseau", "reseau" et "RESEAU" fusionnent.
// Retour : [{ category, books }] dans l'ordre d'affichage final
// (preferentiel, puis nouvelles categories en alphabetique, puis "Autres").
export function groupBooksByCategory(books, getCategory) {
    const groups = new Map();
    for (const book of books || []) {
        const raw = String(getCategory(book) ?? '').trim() || UNCATEGORIZED_LABEL;
        const key = slugify(raw);
        if (!groups.has(key)) {
            // Label affiche : celui de la liste preferentielle si la categorie
            // y figure (graphie canonique), sinon le tag tel que saisi.
            const preferred = PREFERRED_CATEGORY_ORDER.find(c => slugify(c) === key);
            groups.set(key, { key, category: preferred ?? raw, books: [] });
        }
        groups.get(key).books.push(book);
    }

    const preferredKeys = PREFERRED_CATEGORY_ORDER.map(slugify);
    const uncategorizedKey = slugify(UNCATEGORIZED_LABEL);
    const rank = (key) => {
        if (key === uncategorizedKey) return Number.MAX_SAFE_INTEGER;
        const i = preferredKeys.indexOf(key);
        return i >= 0 ? i : preferredKeys.length;
    };

    return [...groups.values()]
        .sort((a, b) => rank(a.key) - rank(b.key) || a.category.localeCompare(b.category, 'fr'))
        .map(({ category, books: groupBooks }) => ({ category, books: groupBooks }));
}

// Remplace les URL Bookstack internes par des ancres hash (routage SPA).
export function rewriteWikiLinks(html) {
    const base = escapeRegex(WIKI_CONFIG.baseUrl.replace(/\/$/, ''));
    html = html.replace(
        new RegExp(`${base}/books/([\\w-]+)/page/([\\w-]+)`, 'g'),
        (_, b, p) => `#/book/${b}/page/${p}`
    );
    html = html.replace(
        new RegExp(`${base}/books/([\\w-]+)/chapter/[\\w-]+`, 'g'),
        (_, b) => `#/book/${b}`
    );
    html = html.replace(
        new RegExp(`${base}/books/([\\w-]+)(?!/)`, 'g'),
        (_, b) => `#/book/${b}`
    );
    return html;
}
