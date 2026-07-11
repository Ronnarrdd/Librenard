// Meta tags dynamiques (titre + OpenGraph + Twitter).
//
// ATTENTION : la mise a jour des meta tags cote client ne fonctionne PAS pour
// la plupart des crawlers de preview (Mastodon, WhatsApp, Telegram, Twitter,
// Facebook...), qui ne lisent que le HTML initial sans executer le JS.
// Elle est tout de meme utile pour :
//  - le titre de l'onglet du navigateur
//  - le titre des signets
//  - les entrees d'historique
//  - les crawlers modernes qui executent JS (Slackbot, Discord, LinkedIn)
// Pour une vraie couverture previews, il faudrait un rendu cote serveur
// (nginx/PHP avec detection User-Agent, Cloudflare Worker, ou pre-rendering
// des articles en HTML statique au build).

export const DEFAULT_META = {};

// On memorise les valeurs initiales de wiki.html, pour pouvoir y revenir
// lorsqu'on retourne sur la vue liste.
export function snapshotDefaultMeta() {
    if (DEFAULT_META.title) return;
    DEFAULT_META.title          = document.title;
    DEFAULT_META.canonical      = document.querySelector('link[rel="canonical"]')?.href || '';
    DEFAULT_META.description    = getMetaContent('name',     'description');
    DEFAULT_META.ogType         = getMetaContent('property', 'og:type') || 'website';
    DEFAULT_META.ogUrl          = getMetaContent('property', 'og:url') || location.href;
    DEFAULT_META.ogTitle        = getMetaContent('property', 'og:title');
    DEFAULT_META.ogDescription  = getMetaContent('property', 'og:description');
    DEFAULT_META.ogImage        = getMetaContent('property', 'og:image');
    DEFAULT_META.twitterTitle   = getMetaContent('name',     'twitter:title');
    DEFAULT_META.twitterDesc    = getMetaContent('name',     'twitter:description');
    DEFAULT_META.twitterImage   = getMetaContent('name',     'twitter:image');
}

function getMetaContent(attrName, attrValue) {
    const el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    return el ? el.getAttribute('content') : '';
}

function setMetaContent(attrName, attrValue, content) {
    if (content == null) return;
    let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

// Extrait du texte propre a partir d'un HTML Bookstack pour en faire une
// description. Strip de tous les tags, compactage des espaces, troncature
// propre a un mot entier + "..."
export function stripHtmlToText(html, maxLen = 200) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    let text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLen) return text;
    const truncated = text.slice(0, maxLen);
    // Remonte jusqu'au dernier espace pour eviter de couper un mot au milieu
    const lastSpace = truncated.lastIndexOf(' ');
    const clean = (lastSpace > maxLen * 0.6) ? truncated.slice(0, lastSpace) : truncated;
    return clean.replace(/[.,;:!?\s]+$/, '') + '…';
}

export function canonicalUrl() {
    return `${location.origin}${location.pathname}${location.hash}`;
}

// URL de la page statique prerendue (scripts/lib/wiki-prerender.mjs)
// correspondant a un livre ou un article. C'est l'URL canonique du contenu :
// les routes hash du SPA ne sont pas des URLs distinctes pour les moteurs.
export function staticWikiUrl(bookSlug, pageSlug) {
    const staticPath = pageSlug
        ? `wiki/${encodeURIComponent(bookSlug)}/${encodeURIComponent(pageSlug)}.html`
        : `wiki/${encodeURIComponent(bookSlug)}.html`;
    return new URL(staticPath, `${location.origin}${location.pathname}`).href;
}

function setCanonical(url) {
    if (!url) return;
    let el = document.querySelector('link[rel="canonical"]');
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
    }
    el.setAttribute('href', url);
}

// API unique : update des titres + descriptions + OG + Twitter d'un seul coup.
export function updateMeta({ title, description, url, image, type = 'website' }) {
    if (title)       document.title = title;
    if (description) setMetaContent('name',     'description',         description);
    setMetaContent('property', 'og:type', type);
    setMetaContent('property', 'og:url',  url || canonicalUrl());
    setCanonical(url);
    if (title)       setMetaContent('property', 'og:title',            title);
    if (description) setMetaContent('property', 'og:description',      description);
    if (image)       setMetaContent('property', 'og:image',            image);
    if (title)       setMetaContent('name',     'twitter:title',       title);
    if (description) setMetaContent('name',     'twitter:description', description);
    if (image)       setMetaContent('name',     'twitter:image',       image);
}

export function resetMeta() {
    updateMeta({
        title:       DEFAULT_META.title,
        description: DEFAULT_META.description,
        url:         DEFAULT_META.canonical || canonicalUrl(),
        image:       DEFAULT_META.ogImage,
        type:        DEFAULT_META.ogType || 'website'
    });
}
