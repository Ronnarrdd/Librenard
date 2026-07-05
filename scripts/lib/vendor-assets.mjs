// Copie les polices, highlight.js et CSS locaux depuis node_modules.
// Execute au build (et en postinstall) : zero requete CDN au runtime.

import { copyFile, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const HLJS_VERSION = '11.9.0';
const HLJS_CDN = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@${HLJS_VERSION}/build`;

const FONT_COPY = [
    ['@fontsource/fredoka/files', 'fredoka-latin-500-normal.woff2'],
    ['@fontsource/fredoka/files', 'fredoka-latin-600-normal.woff2'],
    ['@fontsource/fredoka/files', 'fredoka-latin-700-normal.woff2'],
    ['@fontsource/nunito/files', 'nunito-latin-500-normal.woff2'],
    ['@fontsource/nunito/files', 'nunito-latin-600-normal.woff2'],
    ['@fontsource/nunito/files', 'nunito-latin-700-normal.woff2'],
    ['@fontsource/nunito/files', 'nunito-latin-800-normal.woff2'],
    ['@fontsource/comic-neue/files', 'comic-neue-latin-400-normal.woff2'],
    ['@fontsource/comic-neue/files', 'comic-neue-latin-700-normal.woff2']
];

const OPENDYSLEXIC_COPY = [
    'OpenDyslexic-Regular.woff',
    'OpenDyslexic-Bold.woff',
    'OpenDyslexic-Italic.woff',
    'OpenDyslexic-BoldItalic.woff'
];

async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function copyFromPackage(pkgDir, filename, destDir) {
    const src = path.join(rootDir, 'node_modules', pkgDir, filename);
    const dest = path.join(destDir, filename);
    await copyFile(src, dest);
}

async function fetchToFile(url, dest) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function buildFontsCss() {
    const f = (file, weight, family, style = 'normal') => `@font-face {
    font-family: '${family}';
    font-style: ${style};
    font-weight: ${weight};
    font-display: swap;
    src: url('../vendor/fonts/${file}') format('woff2');
}`;

    return `/* Genere par scripts/lib/vendor-assets.mjs — ne pas editer a la main. */
${f('fredoka-latin-500-normal.woff2', 500, 'Fredoka')}
${f('fredoka-latin-600-normal.woff2', 600, 'Fredoka')}
${f('fredoka-latin-700-normal.woff2', 700, 'Fredoka')}
${f('nunito-latin-500-normal.woff2', 500, 'Nunito')}
${f('nunito-latin-600-normal.woff2', 600, 'Nunito')}
${f('nunito-latin-700-normal.woff2', 700, 'Nunito')}
${f('nunito-latin-800-normal.woff2', 800, 'Nunito')}
${f('comic-neue-latin-400-normal.woff2', 400, 'Comic Neue')}
${f('comic-neue-latin-700-normal.woff2', 700, 'Comic Neue')}
`;
}

function buildOpenDyslexicCss() {
    const face = (file, weight, style) => `@font-face {
    font-family: 'OpenDyslexic';
    font-style: ${style};
    font-weight: ${weight};
    font-display: swap;
    src: url('../vendor/fonts/${file}') format('woff');
}`;

    return `/* Genere par scripts/lib/vendor-assets.mjs */
${face('OpenDyslexic-Regular.woff', 400, 'normal')}
${face('OpenDyslexic-Bold.woff', 700, 'normal')}
${face('OpenDyslexic-Italic.woff', 400, 'italic')}
${face('OpenDyslexic-BoldItalic.woff', 700, 'italic')}
`;
}

/**
 * Installe les assets vendor locaux (polices, highlight.js).
 * @param {{ quiet?: boolean }} [opts]
 */
export async function setupVendorAssets({ quiet = false } = {}) {
    const fontsDir = path.join(rootDir, 'vendor/fonts');
    const hlDir = path.join(rootDir, 'vendor/highlight');
    await mkdir(fontsDir, { recursive: true });
    await mkdir(hlDir, { recursive: true });

    for (const [pkgDir, filename] of FONT_COPY) {
        await copyFromPackage(pkgDir, filename, fontsDir);
    }

    for (const filename of OPENDYSLEXIC_COPY) {
        const src = path.join(rootDir, 'node_modules/open-dyslexic/woff', filename);
        await copyFile(src, path.join(fontsDir, filename));
    }

    const hlJs = path.join(hlDir, 'highlight.min.js');
    const hlCss = path.join(hlDir, 'atom-one-dark.min.css');
    if (!(await exists(hlJs)) || !(await exists(hlCss))) {
        await fetchToFile(`${HLJS_CDN}/highlight.min.js`, hlJs);
        await fetchToFile(`${HLJS_CDN}/styles/atom-one-dark.min.css`, hlCss);
    }

    await writeFile(path.join(rootDir, 'css/fonts.css'), buildFontsCss(), 'utf8');
    await writeFile(path.join(fontsDir, 'opendyslexic.css'), buildOpenDyslexicCss(), 'utf8');

    if (!quiet) console.log('Vendor assets installes (polices locales, highlight.js).');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    setupVendorAssets().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
