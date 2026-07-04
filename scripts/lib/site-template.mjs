// Template partage du site : configuration, <head>, navbar, footer, scripts.
// Utilise par build-site.mjs (pages editoriales) et wiki-prerender.mjs
// (pages statiques du wiki), pour garantir une coquille HTML identique.

export const site = {
    url: 'https://librenard.fr',
    basePath: '/site',
    name: 'Librenard',
    author: 'Nolann',
    ogImage: 'https://librenard.fr/site/images/renard.webp',
    description: "Librenard — le site d'un technicien informatique passionné de logiciels libres, d'auto-hébergement et de partage de connaissances.",
    // Etageres Bookstack publiees sur le site, avec la page qui les liste.
    // label/pageHref servent de racine au fil d'Ariane des pages statiques.
    wikiShelves: [
        { slug: 'ressources-references', pageHref: 'wiki.html', label: 'Wiki' },
        { slug: 'projets', pageHref: 'projets.html', label: 'Projets' }
    ]
};

export const navItems = [
    { href: 'index.html', key: 'accueil', label: 'Accueil' },
    { href: 'projets.html', key: 'projets', label: 'Projets' },
    { href: 'wiki.html', key: 'wiki', label: 'Wiki' },
    { href: 'outils.html', key: 'outils', label: 'Outils' },
    { href: 'contact.html', key: 'contact', label: 'Contact' },
    { href: 'a-propos.html', key: 'a-propos', label: 'À propos' }
];

export const defaultFontHref = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@500;600;700;800&display=swap';

export function withBasePath(urlPath) {
    const basePath = site.basePath.replace(/\/$/, '');
    if (!basePath) return urlPath;
    if (urlPath === '/') return `${basePath}/`;
    return `${basePath}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
}

// Prefixe relatif ("../", "../../"...) selon la profondeur du fichier de sortie.
export function prefixFor(output) {
    const depth = output.split('/').length - 1;
    return depth ? '../'.repeat(depth) : '';
}

export function indent(text, spaces = 4) {
    const pad = ' '.repeat(spaces);
    return text
        .split('\n')
        .map(line => (line ? `${pad}${line}` : line))
        .join('\n');
}

export function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

// Echappement pour les valeurs d'attributs HTML (descriptions issues du wiki...)
export function escapeAttr(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

export function renderThemeInit() {
    return `<script>
        (function() {
            try {
                var saved = localStorage.getItem('theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark-mode');
                }
            } catch (e) {}
        })();
    </script>`;
}

/**
 * Genere le <head> complet d'une page.
 *
 * @param {object} page
 * @param {string} page.title           Titre de l'onglet.
 * @param {string} page.description     Meta description.
 * @param {string} page.canonicalUrl    URL canonique absolue.
 * @param {string} [page.keywords]      Meta keywords (pages historiques).
 * @param {string} [page.ogTitle]       Titre OpenGraph (defaut : title).
 * @param {string} [page.ogDescription] Description OG (defaut : description).
 * @param {string} [page.ogType]        Type OG (defaut : website).
 * @param {string} [page.ogImage]       Image OG (defaut : site.ogImage).
 * @param {string} [page.twitterTitle]
 * @param {string} [page.twitterDescription]
 * @param {boolean} [page.noindex]
 * @param {string} [page.fontHref]      URL Google Fonts specifique.
 * @param {string} [page.fallbackPrefix] Prefixe CSS de secours (page 404).
 * @param {object} [page.jsonLd]        Donnees structurees a serialiser.
 * @param {string} prefix               Prefixe relatif des assets.
 */
export function renderHead(page, prefix) {
    const canonical = page.canonicalUrl;
    const fontHref = page.fontHref || defaultFontHref;
    const ogImage = page.ogImage || site.ogImage;
    const cssFallback = page.fallbackPrefix
        ? `<link rel="stylesheet" href="${page.fallbackPrefix}css/style.css">`
        : '';
    // JSON.stringify + neutralisation de "<" pour interdire toute fermeture
    // de balise script via le contenu (titres d'articles, etc.).
    const jsonLd = page.jsonLd
        ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replaceAll('<', '\\u003c')}</script>`
        : '';
    const meta = [
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        renderThemeInit(),
        `<meta name="description" content="${escapeAttr(page.description)}">`,
        page.keywords ? `<meta name="keywords" content="${escapeAttr(page.keywords)}">` : '',
        `<meta name="author" content="${site.author}">`,
        page.noindex ? '<meta name="robots" content="noindex">' : '',
        `<link rel="canonical" href="${canonical}">`,
        `<meta property="og:type" content="${page.ogType || 'website'}">`,
        `<meta property="og:url" content="${canonical}">`,
        `<meta property="og:title" content="${escapeAttr(page.ogTitle || page.title)}">`,
        `<meta property="og:description" content="${escapeAttr(page.ogDescription || page.description)}">`,
        `<meta property="og:image" content="${escapeAttr(ogImage)}">`,
        '<meta property="og:locale" content="fr_FR">',
        '<meta name="twitter:card" content="summary_large_image">',
        `<meta name="twitter:title" content="${escapeAttr(page.twitterTitle || page.ogTitle || page.title)}">`,
        `<meta name="twitter:description" content="${escapeAttr(page.twitterDescription || page.ogDescription || page.description)}">`,
        `<meta name="twitter:image" content="${escapeAttr(ogImage)}">`,
        '<meta name="theme-color" content="#ff9a6b" media="(prefers-color-scheme: light)">',
        '<meta name="theme-color" content="#1f1813" media="(prefers-color-scheme: dark)">',
        '<meta name="apple-mobile-web-app-capable" content="yes">',
        '<meta name="apple-mobile-web-app-title" content="Librenard">',
        `<link rel="manifest" href="${prefix}site.webmanifest">`,
        `<link rel="icon" type="image/webp" href="${prefix}images/renard.webp">`,
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        `<link href="${fontHref}" rel="stylesheet">`,
        `<link rel="stylesheet" href="${prefix}css/style.css">`,
        cssFallback,
        jsonLd,
        `<title>${escapeAttr(page.title)}</title>`
    ].filter(Boolean);

    return `<head>\n${indent(meta.join('\n'), 4)}\n</head>`;
}

export function fallbackAttr(page, target) {
    if (!page.fallbackPrefix) return '';
    return ` onerror="this.onerror=null;this.src='${page.fallbackPrefix}${target}'"`;
}

export function renderNav(activeKey, prefix, page = {}) {
    const links = navItems.map(item => {
        const active = item.key === activeKey ? ' class="active"' : '';
        return `<li><a href="${prefix}${item.href}" data-nav="${item.key}"${active}>${item.label}</a></li>`;
    }).join('\n');

    return `<a class="skip-link" href="#main-content">Aller au contenu</a>
<nav class="navbar">
    <div class="navbar-inner">
        <a href="${prefix}index.html" class="navbar-brand">
            <img src="${prefix}images/renard.webp" alt="Librenard"${fallbackAttr(page, 'images/renard.webp')}>
            <span>Librenard</span>
        </a>
        <button class="burger-menu" aria-label="Menu" aria-expanded="false">☰</button>
        <ul class="navbar-links">
${indent(links, 12)}
        </ul>
    </div>
</nav>`;
}

export function renderFooter(prefix = '') {
    return `<footer class="footer">
    <p class="footer-links">
        <a href="https://github.com/Ronnarrdd/Librenard" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span aria-hidden="true">·</span>
        <a href="${prefix}a-propos.html">À propos</a>
        <span aria-hidden="true">·</span>
        <a href="${prefix}contact.html">Contact</a>
    </p>
    <p class="footer-legal">Sous licence <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-NC 4.0</a> · Aucun cookie, aucun tracking.</p>
</footer>`;
}

export function renderScripts(page, prefix) {
    return page.scripts
        .map(script => {
            const type = script.type ? ` type="${script.type}"` : '';
            const fallback = page.fallbackPrefix
                ? ` onerror="var s=document.createElement('script');s.src='${page.fallbackPrefix}${script.src}';document.body.appendChild(s);"`
                : '';
            return `<script${type} src="${prefix}${script.src}"${fallback}></script>`;
        })
        .join('\n');
}

/**
 * Assemble un document HTML complet a partir du contenu de <main>.
 * generatorComment permet de distinguer pages editoriales et pages prerendues.
 * indentContent: false pour du contenu contenant des <pre> (l'indentation
 * ajoutee corromprait les blocs de code).
 */
export function renderDocument({ page, prefix, content, generatorComment, indentContent = true }) {
    const bodyDataPage = page.navKey ? ` data-page="${page.navKey}"` : '';
    const scripts = renderScripts(page, prefix);
    const mainContent = indentContent ? indent(content, 8) : content;

    return `<!DOCTYPE html>
<!-- ${generatorComment} -->
<html lang="fr">
${renderHead(page, prefix)}
<body${bodyDataPage}>
${indent(renderNav(page.navKey, prefix, page), 4)}

    <main class="page" id="main-content">
${mainContent}

${indent(renderFooter(prefix), 8)}
    </main>

${indent(scripts, 4)}
</body>
</html>
`;
}
