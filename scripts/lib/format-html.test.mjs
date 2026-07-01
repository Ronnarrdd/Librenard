import test from 'node:test';
import assert from 'node:assert/strict';
import { formatContent } from './format-html.mjs';

// Reproduit le decalage d'insertion applique par build-site.mjs (indent(content, 8)) :
// on prefixe chaque ligne non vide de `spaces` espaces.
function indentBy(text, spaces) {
    const pad = ' '.repeat(spaces);
    return text
        .split('\n')
        .map(line => (line ? `${pad}${line}` : line))
        .join('\n');
}

// Echantillon calque sur le bug reel : balises soeurs a des indentations
// incoherentes (header a 8 espaces, ses enfants a ~30, listes desalignees).
const messy = [
    '        <header class="page-header">',
    '                            <h1>Titre</h1>',
    '                        <p>Texte</p>',
    '                    </header>',
    '',
    '                    <section class="section">',
    '                            <ul>',
    '                        <li>Un</li>',
    '                                <li>Deux</li>',
    '                            </ul>',
    '                    </section>'
].join('\n');

test('normalise une indentation incoherente vers 4 espaces par niveau', () => {
    const out = formatContent(messy);
    assert.equal(out, [
        '<header class="page-header">',
        '    <h1>Titre</h1>',
        '    <p>Texte</p>',
        '</header>',
        '',
        '<section class="section">',
        '    <ul>',
        '        <li>Un</li>',
        '        <li>Deux</li>',
        '    </ul>',
        '</section>'
    ].join('\n'));
});

test('est idempotent : reformater une sortie deja formatee ne change rien', () => {
    const once = formatContent(messy);
    const twice = formatContent(once);
    assert.equal(twice, once);
});

test('resiste au creep : reinserer avec un decalage puis reformater redonne la meme forme', () => {
    const base = formatContent(messy);
    // Simule plusieurs cycles de build (le contenu est re-insere decale de 8).
    for (const offset of [8, 16, 8]) {
        assert.equal(formatContent(indentBy(base, offset)), base);
    }
});

test('aucune ligne ne comporte d espaces de fin', () => {
    const out = formatContent(messy);
    for (const line of out.split('\n')) {
        assert.equal(line, line.replace(/\s+$/, ''), `ligne avec espace de fin: ${JSON.stringify(line)}`);
    }
});

test('pas de ligne vide en tete ni en fin', () => {
    const out = formatContent('\n\n   <p>ok</p>   \n\n');
    assert.equal(out, '<p>ok</p>');
});

test('conserve les elements inline sur leur ligne', () => {
    const input = '            <p>Voir <a href="#x">le lien</a> et <strong>gras</strong>.</p>';
    const out = formatContent(input);
    assert.equal(out, '<p>Voir <a href="#x">le lien</a> et <strong>gras</strong>.</p>');
});
