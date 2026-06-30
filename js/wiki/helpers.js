// Helpers purs (formatage, echappement, sanitation, slugify, reecriture des liens wiki).

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

// Remplace toutes les URL Bookstack internes par des ancres hash (routage SPA)
export function rewriteWikiLinks(html) {
    const base = escapeRegex(WIKI_CONFIG.baseUrl.replace(/\/$/, ''));
    // page : /books/{b}/page/{p}
    html = html.replace(
        new RegExp(`${base}/books/([\\w-]+)/page/([\\w-]+)`, 'g'),
        (_, b, p) => `#/book/${b}/page/${p}`
    );
    // chapitre : /books/{b}/chapter/{c}  -> renvoie au sommaire du livre
    html = html.replace(
        new RegExp(`${base}/books/([\\w-]+)/chapter/[\\w-]+`, 'g'),
        (_, b) => `#/book/${b}`
    );
    // livre : /books/{b}
    html = html.replace(
        new RegExp(`${base}/books/([\\w-]+)(?!/)`, 'g'),
        (_, b) => `#/book/${b}`
    );
    return html;
}

// Transforme une URL Bookstack en route hash SPA. Retourne null si inconnue.
export function bookstackUrlToHash(url) {
    if (!url) return null;
    const base = escapeRegex(WIKI_CONFIG.baseUrl.replace(/\/$/, ''));
    let m = url.match(new RegExp(`${base}/books/([\\w-]+)/page/([\\w-]+)`));
    if (m) return `#/book/${m[1]}/page/${m[2]}`;
    m = url.match(new RegExp(`${base}/books/([\\w-]+)/chapter/[\\w-]+`));
    if (m) return `#/book/${m[1]}`;
    m = url.match(new RegExp(`${base}/books/([\\w-]+)`));
    if (m) return `#/book/${m[1]}`;
    return null;
}
