import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatContent } from './lib/format-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const site = {
    url: 'https://librenard.fr',
    basePath: '/site',
    name: 'Librenard',
    author: 'Nolann',
    ogImage: 'https://librenard.fr/site/renard.png',
    description: "Librenard — le site d'un technicien informatique passionné de logiciels libres, d'auto-hébergement et de partage de connaissances."
};

const navItems = [
    { href: 'index.html', key: 'accueil', label: 'Accueil' },
    { href: 'projets.html', key: 'projets', label: 'Projets' },
    { href: 'wiki.html', key: 'wiki', label: 'Wiki' },
    { href: 'outils.html', key: 'outils', label: 'Outils' },
    { href: 'contact.html', key: 'contact', label: 'Contact' },
    { href: 'a-propos.html', key: 'a-propos', label: 'À propos' }
];

const defaultFontHref = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@500;600;700;800&display=swap';

const pages = [
    {
        output: 'index.html',
        navKey: 'accueil',
        title: 'Librenard',
        description: site.description,
        keywords: 'logiciel libre, open source, auto-hébergement, YunoHost, Bookstack, documentation, internet libre, Librenard',
        ogTitle: 'Librenard — Pour un internet libre et curieux',
        ogDescription: "Projets libres, outils auto-hébergés et documentation collaborative par un technicien informatique passionné.",
        twitterTitle: 'Librenard — Pour un internet libre et curieux',
        twitterDescription: 'Projets libres, outils auto-hébergés et documentation collaborative.',
        scripts: [
            { src: 'js/script.js' },
            { type: 'module', src: 'js/wiki/main.js' }
        ],
        changefreq: 'weekly',
        priority: '1.0'
    },
    {
        output: 'projets.html',
        navKey: 'projets',
        title: 'Projets - Librenard',
        description: "Les projets de Librenard : documentation collaborative avec Bookstack, auto-hébergement avec YunoHost et exploration de l'internet libre. Partage d'expériences et de connaissances techniques.",
        keywords: 'projets libres, Bookstack, YunoHost, auto-hébergement, documentation, wiki, Librenard',
        ogTitle: 'Projets - Librenard',
        ogDescription: "Documentation collaborative avec Bookstack, auto-hébergement avec YunoHost et exploration du libre.",
        twitterTitle: 'Projets - Librenard',
        twitterDescription: 'Documentation collaborative et auto-hébergement libre.',
        scripts: [
            { src: 'js/script.js' },
            { type: 'module', src: 'js/wiki/main.js' }
        ],
        changefreq: 'monthly',
        priority: '0.8'
    },
    {
        output: 'wiki.html',
        navKey: 'wiki',
        title: 'Wiki - Librenard',
        description: "Wiki Librenard : tutoriels, guides et notes techniques sur le logiciel libre, l'auto-hébergement et les outils numériques respectueux de la vie privée.",
        keywords: 'wiki, Bookstack, tutoriels, logiciel libre, auto-hébergement, guides, documentation',
        ogTitle: 'Wiki - Librenard',
        ogDescription: "Tutoriels et guides sur le logiciel libre, l'auto-hébergement et les outils numériques respectueux de la vie privée.",
        twitterTitle: 'Wiki - Librenard',
        twitterDescription: "Tutoriels et guides sur le libre, l'auto-hébergement et la vie privée numérique.",
        scripts: [
            { src: 'js/script.js' },
            { type: 'module', src: 'js/wiki/main.js' }
        ],
        changefreq: 'weekly',
        priority: '0.9'
    },
    {
        output: 'outils.html',
        navKey: 'outils',
        title: 'Outils - Librenard',
        description: 'Outils libres auto-hébergés par Librenard : Etherpad (édition collaborative), Draw.io (diagrammes) et Piped (alternative YouTube respectueuse). Gratuits, sans pub et sans pistage.',
        keywords: 'Etherpad, Draw.io, Piped, outils libres, auto-hébergement, vie privée, alternatives libres',
        ogTitle: 'Outils libres - Librenard',
        ogDescription: 'Etherpad, Draw.io, Piped… des services libres et respectueux de la vie privée, mis à disposition gratuitement.',
        twitterTitle: 'Outils libres - Librenard',
        twitterDescription: 'Etherpad, Draw.io, Piped — outils libres gratuits et respectueux de la vie privée.',
        scripts: [{ src: 'js/script.js' }],
        changefreq: 'monthly',
        priority: '0.8'
    },
    {
        output: 'contact.html',
        navKey: 'contact',
        title: 'Contact - Librenard',
        description: 'Contactez Librenard — technicien informatique passionné par le libre et le partage. Coordonnées, centres d’intérêt et parcours.',
        keywords: 'contact, Librenard, technicien informatique, médiateur numérique, logiciel libre',
        ogTitle: 'Contact - Librenard',
        ogDescription: "Me joindre et découvrir mes centres d'intérêt autour du libre et du partage de connaissances.",
        twitterTitle: 'Contact - Librenard',
        twitterDescription: 'Me joindre et découvrir mon parcours.',
        scripts: [{ src: 'js/script.js' }],
        changefreq: 'yearly',
        priority: '0.6'
    },
    {
        output: 'a-propos.html',
        navKey: 'a-propos',
        title: 'À propos - Librenard',
        description: 'À propos du site Librenard : licence Creative Commons, confidentialité sans tracking, technologies utilisées et crédits des illustrations.',
        keywords: 'à propos, licence, Creative Commons, CC BY-NC, confidentialité, Librenard',
        ogTitle: 'À propos - Librenard',
        ogDescription: 'Licence, confidentialité, technologies et philosophie du site Librenard.',
        twitterTitle: 'À propos - Librenard',
        twitterDescription: 'Licence, confidentialité et philosophie du site.',
        scripts: [{ src: 'js/script.js' }],
        changefreq: 'yearly',
        priority: '0.5'
    },
    {
        output: 'error/404.html',
        title: 'Oups… page introuvable - Librenard',
        description: "Oups ! Cette page est introuvable. Le renard s'est perdu en chemin — retrouvez votre route sur Librenard.",
        ogTitle: 'Page introuvable - Librenard',
        ogDescription: "Le renard s'est perdu en chemin… Cette page n'existe pas sur Librenard.",
        ogPath: '/404.html',
        noindex: true,
        assetPrefix: '/site/',
        fallbackPrefix: '../',
        rootRelativeContent: true,
        scripts: [{ src: 'js/script.js' }],
        fontHref: 'https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap'
    }
];

function prefixFor(output) {
    const depth = output.split('/').length - 1;
    return depth ? '../'.repeat(depth) : '';
}

function withBasePath(urlPath) {
    const basePath = site.basePath.replace(/\/$/, '');
    if (!basePath) return urlPath;
    if (urlPath === '/') return `${basePath}/`;
    return `${basePath}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
}

function publicPath(output) {
    if (output === 'index.html') return withBasePath('/');
    return withBasePath(`/${output.replace(/^error\/404\.html$/, '404.html')}`);
}

function absoluteUrl(output, page) {
    return `${site.url}${page.ogPath ? withBasePath(page.ogPath) : publicPath(output)}`;
}

function indent(text, spaces = 4) {
    const pad = ' '.repeat(spaces);
    return text
        .split('\n')
        .map(line => (line ? `${pad}${line}` : line))
        .join('\n');
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function renderThemeInit() {
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

function renderHead(page, prefix) {
    const canonical = absoluteUrl(page.output, page);
    const fontHref = page.fontHref || defaultFontHref;
    const cssFallback = page.fallbackPrefix
        ? `<link rel="stylesheet" href="${page.fallbackPrefix}css/style.css">`
        : '';
    const meta = [
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        renderThemeInit(),
        `<meta name="description" content="${page.description}">`,
        page.keywords ? `<meta name="keywords" content="${page.keywords}">` : '',
        `<meta name="author" content="${site.author}">`,
        page.noindex ? '<meta name="robots" content="noindex">' : '',
        `<link rel="canonical" href="${canonical}">`,
        '<meta property="og:type" content="website">',
        `<meta property="og:url" content="${canonical}">`,
        `<meta property="og:title" content="${page.ogTitle || page.title}">`,
        `<meta property="og:description" content="${page.ogDescription || page.description}">`,
        `<meta property="og:image" content="${site.ogImage}">`,
        '<meta property="og:locale" content="fr_FR">',
        '<meta name="twitter:card" content="summary_large_image">',
        `<meta name="twitter:title" content="${page.twitterTitle || page.ogTitle || page.title}">`,
        `<meta name="twitter:description" content="${page.twitterDescription || page.ogDescription || page.description}">`,
        `<meta name="twitter:image" content="${site.ogImage}">`,
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
        `<title>${page.title}</title>`
    ].filter(Boolean);

    return `<head>\n${indent(meta.join('\n'), 4)}\n</head>`;
}

function fallbackAttr(page, target) {
    if (!page.fallbackPrefix) return '';
    return ` onerror="this.onerror=null;this.src='${page.fallbackPrefix}${target}'"`;
}

function renderNav(activeKey, prefix, page = {}) {
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

function renderFooter() {
    return `<footer class="footer">
    <p>Sous licence <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-NC 4.0</a>.</p>
</footer>`;
}

function renderScripts(page, prefix) {
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

function extractPageContent(html) {
    const mainMatch = html.match(/<main class="page" id="main-content">([\s\S]*?)<\/main>/);
    if (!mainMatch) throw new Error('Balise <main class="page" id="main-content"> introuvable.');

    return formatContent(mainMatch[1]
        .replace(/\n\s*<footer class="footer">[\s\S]*?<\/footer>\s*/m, '\n')
    );
}

function normalizePageContent(content, page) {
    if (!page.rootRelativeContent) return content;
    const publicPrefix = `${site.basePath.replace(/\/$/, '')}/`;

    return content
        .replace(/\s+onerror="this\.onerror=null;this\.src='[^']+'"/g, '')
        .replace(/\s+onerror="var s=document\.createElement\('script'\);s\.src='[^']+';document\.body\.appendChild\(s\);"/g, '')
        .replaceAll('href="../', `href="${publicPrefix}`)
        .replaceAll('src="../', `src="${publicPrefix}`)
        .replaceAll('href="/', `href="${publicPrefix}`)
        .replaceAll('src="/', `src="${publicPrefix}`)
        .replace(new RegExp(`href="${publicPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${site.basePath.replace(/^\//, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`, 'g'), `href="${publicPrefix}`)
        .replace(new RegExp(`src="${publicPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${site.basePath.replace(/^\//, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`, 'g'), `src="${publicPrefix}`)
        .replace(new RegExp(`<img src="${publicPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^"]+)"`, 'g'), (match, target) => {
            return `<img src="${publicPrefix}${target}"${fallbackAttr(page, target)}`;
        });
}

async function renderPage(page) {
    const filePath = path.join(rootDir, page.output);
    const currentHtml = await readFile(filePath, 'utf8');
    const content = normalizePageContent(extractPageContent(currentHtml), page);
    const prefix = page.assetPrefix ?? prefixFor(page.output);
    const bodyDataPage = page.navKey ? ` data-page="${page.navKey}"` : '';
    const scripts = renderScripts(page, prefix);

    return `<!DOCTYPE html>
<!-- Generated by scripts/build-site.mjs. Edit page-specific content in this file, then run npm run build. -->
<html lang="fr">
${renderHead(page, prefix)}
<body${bodyDataPage}>
${indent(renderNav(page.navKey, prefix, page), 4)}

    <main class="page" id="main-content">
${indent(content, 8)}

${indent(renderFooter(), 8)}
    </main>

${indent(scripts, 4)}
</body>
</html>
`;
}

async function buildPages() {
    for (const page of pages) {
        const html = await renderPage(page);
        await writeFile(path.join(rootDir, page.output), html, 'utf8');
        console.log(`Generated ${page.output}`);
    }
}

async function buildSitemap() {
    const lastmod = new Date().toISOString().slice(0, 10);
    const entries = pages
        .filter(page => !page.noindex)
        .map(page => `    <url>
        <loc>${escapeXml(absoluteUrl(page.output, page))}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>${page.changefreq}</changefreq>
        <priority>${page.priority}</priority>
    </url>`)
        .join('\n');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
    await writeFile(path.join(rootDir, 'sitemap.xml'), sitemap, 'utf8');
    console.log('Generated sitemap.xml');
}

async function buildRobots() {
    const robots = `User-agent: *
Allow: /

Sitemap: ${site.url}${withBasePath('/sitemap.xml')}
`;
    await writeFile(path.join(rootDir, 'robots.txt'), robots, 'utf8');
    console.log('Generated robots.txt');
}

async function buildManifest() {
    const manifest = {
        name: 'Librenard',
        short_name: 'Librenard',
        description: site.description,
        lang: 'fr',
        start_url: publicPath('index.html'),
        scope: publicPath('index.html'),
        display: 'standalone',
        background_color: '#fef6ec',
        theme_color: '#ff9a6b',
        icons: [
            {
                src: withBasePath('/images/renard.webp'),
                sizes: '192x192',
                type: 'image/webp',
                purpose: 'any maskable'
            },
            {
                src: withBasePath('/images/renard3d.webp'),
                sizes: '512x512',
                type: 'image/webp',
                purpose: 'any'
            }
        ]
    };

    await writeFile(path.join(rootDir, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log('Generated site.webmanifest');
}

await buildPages();
await buildSitemap();
await buildRobots();
await buildManifest();
