// Tests des routes wiki (js/wiki/helpers.js) : chemin des pages statiques
// partageables et redirection des anciennes routes hash du SPA.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { staticWikiPath, parseWikiHash } from '../../js/wiki/helpers.js';

// ---------- staticWikiPath ----------

test('staticWikiPath : livre seul', () => {
    assert.equal(staticWikiPath('bases-de-linux'), 'wiki/bases-de-linux.html');
});

test('staticWikiPath : article d\'un livre', () => {
    assert.equal(
        staticWikiPath('bases-de-linux', 'le-chargeur-damorcage-grub'),
        'wiki/bases-de-linux/le-chargeur-damorcage-grub.html'
    );
});

test('staticWikiPath : ancre de section encodee', () => {
    assert.equal(
        staticWikiPath('bases-de-linux', 'grub', 'bkmrk-%C3%A9tape-1'),
        'wiki/bases-de-linux/grub.html#bkmrk-%25C3%25A9tape-1'
    );
});

test('staticWikiPath : slugs avec caracteres a encoder', () => {
    assert.equal(staticWikiPath('a/b', 'c d'), 'wiki/a%2Fb/c%20d.html');
});

// ---------- parseWikiHash ----------

test('parseWikiHash : hash vide ou racine -> liste', () => {
    assert.deepEqual(parseWikiHash(''), { name: 'list' });
    assert.deepEqual(parseWikiHash('#'), { name: 'list' });
    assert.deepEqual(parseWikiHash('#/'), { name: 'list' });
    assert.deepEqual(parseWikiHash(null), { name: 'list' });
});

test('parseWikiHash : route livre', () => {
    assert.deepEqual(parseWikiHash('#/book/bases-de-linux'), {
        name: 'book',
        bookSlug: 'bases-de-linux'
    });
});

test('parseWikiHash : route article', () => {
    assert.deepEqual(parseWikiHash('#/book/bases-de-linux/page/le-raid'), {
        name: 'page',
        bookSlug: 'bases-de-linux',
        pageSlug: 'le-raid',
        sectionSlug: null
    });
});

test('parseWikiHash : deep-link de section (/h/<id>)', () => {
    assert.deepEqual(parseWikiHash('#/book/b/page/p/h/ma-section'), {
        name: 'page',
        bookSlug: 'b',
        pageSlug: 'p',
        sectionSlug: 'ma-section'
    });
});

test('parseWikiHash : segments encodes decodes', () => {
    const state = parseWikiHash('#/book/mon%20livre/page/ma%20page');
    assert.equal(state.bookSlug, 'mon livre');
    assert.equal(state.pageSlug, 'ma page');
});

test('parseWikiHash : route inconnue -> liste', () => {
    assert.deepEqual(parseWikiHash('#/nimporte/quoi'), { name: 'list' });
    assert.deepEqual(parseWikiHash('#/book'), { name: 'list' });
});

// ---------- aller-retour hash -> page statique ----------

test('redirection : un hash de livre pointe vers la page statique du livre', () => {
    const state = parseWikiHash('#/book/bases-de-linux');
    assert.equal(staticWikiPath(state.bookSlug, state.pageSlug, state.sectionSlug), 'wiki/bases-de-linux.html');
});

test('redirection : un hash d\'article avec section pointe vers l\'article + ancre', () => {
    const state = parseWikiHash('#/book/bases-de-linux/page/le-raid/h/avantages');
    assert.equal(
        staticWikiPath(state.bookSlug, state.pageSlug, state.sectionSlug),
        'wiki/bases-de-linux/le-raid.html#avantages'
    );
});
