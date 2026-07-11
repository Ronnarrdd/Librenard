import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bookCardStaticHtml } from './wiki-prerender.mjs';

const BOOK = {
    slug: 'bases-de-linux',
    name: 'Bases de Linux',
    description: 'Tout pour débuter.',
    updated_at: '2026-04-22T18:39:08.000000Z',
    cover: { url: 'https://librenard.fr/wiki/uploads/cover.png' }
};

test('bookCardStaticHtml : badge temps de lecture quand readingMinutes est defini', () => {
    const html = bookCardStaticHtml({ ...BOOK, readingMinutes: 7 });
    assert.ok(html.includes('class="book-card-reading-time"'), html);
    assert.ok(html.includes('~7 min<span class="sr-only"> de lecture</span>'), html);
    // Le badge doit etre hors du bloc couverture (aria-hidden), en frere direct.
    const coverEnd = html.indexOf('</div>');
    const badgePos = html.indexOf('book-card-reading-time');
    assert.ok(badgePos > coverEnd, 'badge attendu apres la fermeture de la couverture');
});

test('bookCardStaticHtml : pas de badge sans readingMinutes (livre vide ou manifest absent)', () => {
    assert.ok(!bookCardStaticHtml(BOOK).includes('book-card-reading-time'));
    assert.ok(!bookCardStaticHtml({ ...BOOK, readingMinutes: null }).includes('book-card-reading-time'));
});

test('bookCardStaticHtml : structure de carte inchangee (lien, titre, date)', () => {
    const html = bookCardStaticHtml({ ...BOOK, readingMinutes: 3 });
    assert.ok(html.includes('href="wiki/bases-de-linux.html"'));
    assert.ok(html.includes('Bases de Linux'));
    assert.ok(html.includes('Mis à jour le 22 avril 2026'));
});
