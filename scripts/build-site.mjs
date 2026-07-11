import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatContent } from './lib/format-html.mjs';
import { site, withBasePath, prefixFor, renderDocument, escapeXml, fallbackAttr } from './lib/site-template.mjs';
import { prerenderWiki, bookCardStaticHtml } from './lib/wiki-prerender.mjs';
import { setupVendorAssets } from './lib/vendor-assets.mjs';
import { buildPagefindIndex } from './lib/pagefind-index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// --no-wiki : saute le prerendu Bookstack (build hors ligne). Le sitemap
// reutilise alors le manifest genere par le dernier prerendu.
const skipWiki = process.argv.includes('--no-wiki');

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
        scripts: [{ src: 'js/script.js' }]
    }
];

await setupVendorAssets();

async function hasWikiPages() {
    const wikiDir = path.join(rootDir, 'wiki');
    try {
        const entries = await readdir(wikiDir, { recursive: true, withFileTypes: true });
        return entries.some(e => e.isFile() && e.name.endsWith('.html'));
    } catch {
        return false;
    }
}

function publicPath(output) {
    if (output === 'index.html') return withBasePath('/');
    return withBasePath(`/${output.replace(/^error\/404\.html$/, '404.html')}`);
}

function absoluteUrl(output, page) {
    return `${site.url}${page.ogPath ? withBasePath(page.ogPath) : publicPath(output)}`;
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

// Remplace le contenu de la <section id="wiki-view"> par la grille de livres
// prerendue : liens reels crawlables + contenu visible sans JS. Au chargement,
// js/wiki/main.js re-rend la meme grille depuis l'API (dates relatives, frais).
// IMPORTANT : #wiki-view doit etre une <section> ne contenant aucune autre
// section (la regex non-greedy s'arrete au premier </section> rencontre).
function injectWikiGrid(content, books, output) {
    const grid = `<div class="books-grid">\n${books.map(bookCardStaticHtml).join('\n')}\n</div>`;
    const replaced = content.replace(
        /(<section id="wiki-view"[^>]*>)[\s\S]*?(<\/section>)/,
        `$1\n${grid}\n$2`
    );
    if (replaced === content) throw new Error(`Section #wiki-view introuvable dans ${output}.`);
    return replaced;
}

// Etagere Bookstack affichee par chaque page (doit correspondre a
// l'attribut data-shelf du #wiki-view de la page).
const pageShelves = {
    'wiki.html': 'ressources-references',
    'projets.html': 'projets'
};

async function renderPage(page, booksByShelf) {
    const filePath = path.join(rootDir, page.output);
    const currentHtml = await readFile(filePath, 'utf8');
    let content = normalizePageContent(extractPageContent(currentHtml), page);
    const shelfSlug = pageShelves[page.output];
    if (shelfSlug && booksByShelf?.[shelfSlug]) {
        content = formatContent(injectWikiGrid(content, booksByShelf[shelfSlug], page.output));
    }
    const prefix = page.assetPrefix ?? prefixFor(page.output);

    return renderDocument({
        page: { ...page, canonicalUrl: absoluteUrl(page.output, page) },
        prefix,
        content,
        generatorComment: 'Generated by scripts/build-site.mjs. Edit page-specific content in this file, then run npm run build.'
    });
}

async function buildPages(booksByShelf) {
    for (const page of pages) {
        const html = await renderPage(page, booksByShelf);
        await writeFile(path.join(rootDir, page.output), html, 'utf8');
        console.log(`Generated ${page.output}`);
    }
}

async function loadWikiSitemapEntries() {
    try {
        const manifest = await readFile(path.join(rootDir, 'wiki', 'sitemap-manifest.json'), 'utf8');
        return JSON.parse(manifest);
    } catch (_) {
        console.warn('Pas de manifest wiki (wiki/sitemap-manifest.json) : sitemap sans les pages du wiki.');
        return [];
    }
}

async function buildSitemap(wikiEntries) {
    const lastmod = new Date().toISOString().slice(0, 10);
    const entries = [
        ...pages
            .filter(page => !page.noindex)
            .map(page => ({
                loc: absoluteUrl(page.output, page),
                lastmod,
                changefreq: page.changefreq,
                priority: page.priority
            })),
        ...wikiEntries
    ];

    const xml = entries.map(entry => `    <url>
        <loc>${escapeXml(entry.loc)}</loc>
        <lastmod>${entry.lastmod}</lastmod>
        <changefreq>${entry.changefreq}</changefreq>
        <priority>${entry.priority}</priority>
    </url>`).join('\n');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xml}
</urlset>
`;
    await writeFile(path.join(rootDir, 'sitemap.xml'), sitemap, 'utf8');
    console.log(`Generated sitemap.xml (${entries.length} URLs)`);
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

let booksByShelf = null;
let wikiEntries;
if (skipWiki) {
    console.log('Prerendu wiki saute (--no-wiki).');
    wikiEntries = await loadWikiSitemapEntries();
} else {
    const result = await prerenderWiki(rootDir);
    booksByShelf = result.booksByShelf;
    wikiEntries = result.sitemapEntries;
}

await buildPages(booksByShelf);
await buildSitemap(wikiEntries);
await buildRobots();
await buildManifest();

if (await hasWikiPages()) {
    await buildPagefindIndex(rootDir);
}
