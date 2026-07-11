import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectRecentPages } from '../../js/wiki/api.js';

// Pages telles que renvoyees par /pages?sort=-updated_at (deja triees).
const PAGES = [
    { id: 1, name: 'Page A', book_id: 10, draft: false, updated_at: '2026-07-08T18:00:00Z' },
    { id: 2, name: 'Brouillon', book_id: 10, draft: true, updated_at: '2026-07-08T17:00:00Z' },
    { id: 3, name: 'Page B', book_id: 20, draft: false, updated_at: '2026-07-04T15:00:00Z' },
    { id: 4, name: 'Page C', book_id: 30, draft: false, updated_at: '2026-07-01T15:00:00Z' },
    { id: 5, name: 'Page D', book_id: 10, draft: false, updated_at: '2026-06-28T18:00:00Z' }
];

test('selectRecentPages : ecarte les brouillons', () => {
    const out = selectRecentPages(PAGES, null, 10);
    assert.deepEqual(out.map(p => p.id), [1, 3, 4, 5]);
});

test('selectRecentPages : restreint aux livres visibles (etagere)', () => {
    const out = selectRecentPages(PAGES, new Set([10, 30]), 10);
    assert.deepEqual(out.map(p => p.id), [1, 4, 5]);
});

test('selectRecentPages : coupe a la limite en gardant l\'ordre API', () => {
    const out = selectRecentPages(PAGES, null, 2);
    assert.deepEqual(out.map(p => p.id), [1, 3]);
});

test('selectRecentPages : sans filtre d\'etagere, tout livre est visible', () => {
    const out = selectRecentPages(PAGES, null, 100);
    assert.equal(out.length, 4);
});

test('selectRecentPages : entree vide ou nulle', () => {
    assert.deepEqual(selectRecentPages([], null, 4), []);
    assert.deepEqual(selectRecentPages(null, null, 4), []);
});
