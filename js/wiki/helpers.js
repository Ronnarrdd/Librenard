// Helpers purs (formatage, echappement, sanitation, slugify, routes wiki).

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
