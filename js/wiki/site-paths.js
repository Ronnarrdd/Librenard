// Chemins absolus du site (meta site-base) pour imports dynamiques sans CDN.

export function getSiteBase() {
    const meta = document.querySelector('meta[name="site-base"]');
    if (meta?.content) return meta.content.replace(/\/$/, '');
    const m = location.pathname.match(/^(\/site)/);
    return m ? m[1] : '';
}

export function assetUrl(relPath) {
    const base = getSiteBase();
    const path = relPath.replace(/^\//, '');
    return base ? `${base}/${path}` : `/${path}`;
}

/** URL absolue d'un resultat Pagefind (chemins relatifs a la racine du site). */
export function resolveSiteUrl(url) {
    if (!url) return url;
    if (/^https?:\/\//.test(url)) return url;
    const base = getSiteBase();
    if (url.startsWith('/')) {
        if (base && url.startsWith(`${base}/`)) return url;
        return base ? `${base}${url}` : url;
    }
    return assetUrl(url);
}

export function pagefindModuleUrl() {
    return new URL(assetUrl('pagefind/pagefind.js'), location.origin).href;
}
