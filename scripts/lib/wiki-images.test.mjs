import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    extractUploadUrls,
    altFromFilename,
    isBadAlt,
    localMirrorPath,
    relAssetHref,
    rewriteImagesInHtml
} from './wiki-images.mjs';

const UPLOADS = 'https://librenard.fr/wiki/uploads';

test('extractUploadUrls : img src et liens', () => {
    const html = '<img src="https://librenard.fr/wiki/uploads/images/gallery/2024-04/foo.png">'
        + '<a href="https://librenard.fr/wiki/uploads/images/gallery/2024-04/bar.png">';
    const urls = extractUploadUrls(html, UPLOADS);
    assert.equal(urls.length, 2);
    assert.ok(urls[0].includes('foo.png'));
});

test('altFromFilename : nettoie les noms generiques', () => {
    assert.equal(altFromFilename('commercialisation.png'), 'Commercialisation');
    assert.equal(altFromFilename('image.png'), '');
});

test('isBadAlt : detecte les alt BookStack generiques', () => {
    assert.equal(isBadAlt(''), true);
    assert.equal(isBadAlt('image.png'), true);
    assert.equal(isBadAlt('Description utile'), false);
});

test('localMirrorPath : convertit en webp sous images/wiki', () => {
    const url = `${UPLOADS}/images/gallery/2024-04/foo.png`;
    assert.equal(localMirrorPath(url, UPLOADS), 'images/wiki/images/gallery/2024-04/foo.webp');
});

test('relAssetHref : chemins relatifs selon la profondeur', () => {
    assert.equal(
        relAssetHref('wiki/livre/article.html', 'images/wiki/x.webp'),
        '../../images/wiki/x.webp'
    );
});

test('rewriteImagesInHtml : src local, lazy loading et alt corrige', () => {
    const remote = `${UPLOADS}/images/gallery/2024-04/commercialisation.png`;
    const map = new Map([[remote, {
        path: 'images/wiki/images/gallery/2024-04/commercialisation.webp',
        width: 150,
        height: 150,
        alt: 'Commercialisation'
    }]]);
    const html = `<img class="align-right" src="${remote}" alt="commercialisation.png" width="150" height="150">`;
    const out = rewriteImagesInHtml(html, map, { fromOutput: 'wiki/livre/page.html' });
    assert.ok(out.includes('../../images/wiki/images/gallery/2024-04/commercialisation.webp'));
    assert.ok(out.includes('loading="eager"'));
    assert.ok(out.includes('alt="Commercialisation"'));
});
