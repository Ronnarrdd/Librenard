import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    bookOutputPath,
    articleOutputPath,
    decodeEntities,
    stripHtmlText,
    wordCountFromHtml,
    readingMinutes,
    readingTimesManifest,
    formatDateFr,
    ensureHeadingIds,
    rewriteBookstackLinks
} from './wiki-static.mjs';

// ---------- Chemins ----------

test('bookOutputPath et articleOutputPath', () => {
    assert.equal(bookOutputPath('bases-de-linux'), 'wiki/bases-de-linux.html');
    assert.equal(
        articleOutputPath('bases-de-linux', 'le-systeme-de-fichiers-linux'),
        'wiki/bases-de-linux/le-systeme-de-fichiers-linux.html'
    );
});

// ---------- Entites ----------

test('decodeEntities : entites nommees, decimales et hexadecimales', () => {
    assert.equal(decodeEntities('Ressources &amp; R&eacute;f&#233;rences'), 'Ressources & Références');
    assert.equal(decodeEntities('a &lt; b &gt; c &quot;d&quot;'), 'a < b > c "d"');
    assert.equal(decodeEntities('&#x27;ok&#x27;'), "'ok'");
    assert.equal(decodeEntities('inconnue &zzz; reste'), 'inconnue &zzz; reste');
});

// ---------- stripHtmlText ----------

test('stripHtmlText : supprime les balises et compacte les espaces', () => {
    const html = '<h2 id="x">Titre</h2><p class="MsoNormal"><strong>Linux</strong> est\n\n un  systeme.</p>';
    assert.equal(stripHtmlText(html), 'Titre Linux est un systeme.');
});

test('stripHtmlText : ignore script et style', () => {
    assert.equal(stripHtmlText('<p>a</p><script>var x = 1;</script><style>p{}</style><p>b</p>'), 'a b');
});

test('stripHtmlText : tronque a un mot entier avec ellipse', () => {
    const out = stripHtmlText('<p>un deux trois quatre cinq six sept huit</p>', 20);
    assert.ok(out.length <= 21);
    assert.ok(out.endsWith('…'));
    assert.ok(!out.includes('quat'), `coupe au milieu d'un mot : ${out}`);
});

test('stripHtmlText : texte court retourne tel quel, vide gere', () => {
    assert.equal(stripHtmlText('<p>court</p>', 200), 'court');
    assert.equal(stripHtmlText(''), '');
    assert.equal(stripHtmlText(null), '');
});

// ---------- Temps de lecture ----------

test('wordCountFromHtml et readingMinutes', () => {
    assert.equal(wordCountFromHtml('<p>un deux trois</p>'), 3);
    assert.equal(wordCountFromHtml(''), 0);
    assert.equal(readingMinutes(0), 1);
    assert.equal(readingMinutes(219), 1);
    assert.equal(readingMinutes(440), 2);
});

test('readingTimesManifest : somme les mots de toutes les pages d\'un livre', () => {
    const mots = n => `<p>${Array.from({ length: n }, (_, i) => `mot${i}`).join(' ')}</p>`;
    const books = [
        {
            slug: 'bases-de-linux',
            flatPages: [
                { detail: { html: mots(300) } },
                { detail: { html: mots(360) } }
            ]
        },
        { slug: 'petit-livre', flatPages: [{ detail: { html: mots(10) } }] }
    ];
    assert.deepEqual(readingTimesManifest(books), {
        'bases-de-linux': 3,   // 660 mots / 220
        'petit-livre': 1       // minimum 1 min
    });
});

test('readingTimesManifest : omet les livres sans page publiee', () => {
    const books = [
        { slug: 'vide', flatPages: [] },
        { slug: 'sans-flat' }
    ];
    assert.deepEqual(readingTimesManifest(books), {});
});

test('readingTimesManifest : page sans detail comptee comme 0 mot', () => {
    const books = [{ slug: 'incomplet', flatPages: [{ detail: null }, {}] }];
    assert.deepEqual(readingTimesManifest(books), { incomplet: 1 });
});

// ---------- Dates ----------

test('formatDateFr : format long francais', () => {
    assert.equal(formatDateFr('2026-04-22T18:39:08.000000Z'), '22 avril 2026');
    assert.equal(formatDateFr('2024-01-01T00:00:00.000000Z'), '1 janvier 2024');
    assert.equal(formatDateFr('pas-une-date'), '');
});

// ---------- ensureHeadingIds ----------

test('ensureHeadingIds : conserve les ids Bookstack existants', () => {
    const html = '<h2 id="bkmrk-quest-ce-que-linux">Qu’est-ce que Linux ?</h2><p>...</p>';
    const { html: out, headings } = ensureHeadingIds(html);
    assert.equal(out, html);
    assert.deepEqual(headings, [{ id: 'bkmrk-quest-ce-que-linux', text: 'Qu’est-ce que Linux ?', level: 2 }]);
});

test('ensureHeadingIds : ajoute des ids slugifies aux titres qui en manquent', () => {
    const html = '<h2>Première section</h2><h3>Sous partie</h3>';
    const { html: out, headings } = ensureHeadingIds(html);
    assert.ok(out.includes('<h2 id="premiere-section">'));
    assert.ok(out.includes('<h3 id="sous-partie">'));
    assert.deepEqual(headings.map(h => h.level), [2, 3]);
});

test('ensureHeadingIds : dedoublonne les ids generes', () => {
    const html = '<h2>Section</h2><h2>Section</h2><h2 id="section-1">Autre</h2>';
    const { headings } = ensureHeadingIds(html);
    const ids = headings.map(h => h.id);
    assert.equal(new Set(ids).size, ids.length, `ids en double : ${ids}`);
    assert.ok(ids.includes('section'));
});

// ---------- rewriteBookstackLinks ----------

const REWRITE_OPTS = {
    wikiBaseUrl: 'https://librenard.fr/wiki',
    resolvePage: (b, p) => (b === 'bases-de-linux' ? `../${b}/${p}.html` : null),
    resolveBook: (b) => (b === 'bases-de-linux' ? `../${b}.html` : null)
};

test('rewriteBookstackLinks : article publie -> chemin statique (ancre conservee)', () => {
    const html = '<a href="https://librenard.fr/wiki/books/bases-de-linux/page/le-raid#bkmrk-x">lien</a>';
    const out = rewriteBookstackLinks(html, REWRITE_OPTS);
    assert.equal(out, '<a href="../bases-de-linux/le-raid.html#bkmrk-x">lien</a>');
});

test('rewriteBookstackLinks : livre publie et chapitre -> sommaire statique', () => {
    const html = '<a href="https://librenard.fr/wiki/books/bases-de-linux">livre</a>'
        + '<a href="https://librenard.fr/wiki/books/bases-de-linux/chapter/intro">chap</a>';
    const out = rewriteBookstackLinks(html, REWRITE_OPTS);
    assert.equal(out, '<a href="../bases-de-linux.html">livre</a><a href="../bases-de-linux.html">chap</a>');
});

test('rewriteBookstackLinks : cible hors perimetre -> URL Bookstack conservee', () => {
    const html = '<a href="https://librenard.fr/wiki/books/prive/page/secret">x</a>';
    assert.equal(rewriteBookstackLinks(html, REWRITE_OPTS), html);
});

test('rewriteBookstackLinks : ne tronque pas un slug plus long', () => {
    const html = '<a href="https://librenard.fr/wiki/books/bases-de-linux-avance">x</a>';
    assert.equal(rewriteBookstackLinks(html, REWRITE_OPTS), html);
});
