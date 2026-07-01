import beautify from 'js-beautify';

const htmlBeautify = beautify.html;

// Options volontairement conservatrices : on veut une sortie STABLE et
// idempotente, pas une reecriture agressive du balisage.
// - wrap_line_length: 0  -> ne jamais couper une ligne (sinon les attributs
//   longs partent a la ligne et le diff change selon la longueur).
// - preserve_newlines + max_preserve_newlines: 1 -> on garde au plus une ligne
//   vide entre blocs, ce qui evite l'accumulation de lignes vides.
// - end_with_newline: false -> l'appelant gere l'indentation d'insertion.
const BEAUTIFY_OPTIONS = {
    indent_size: 4,
    indent_char: ' ',
    wrap_line_length: 0,
    preserve_newlines: true,
    max_preserve_newlines: 1,
    end_with_newline: false,
    indent_inner_html: false,
    content_unformatted: ['pre', 'textarea'],
    extra_liners: []
};

/**
 * Reindente un fragment HTML de maniere deterministe et idempotente.
 *
 * Le beautifier ignore l'indentation d'entree et la recalcule depuis la
 * structure des balises. Consequence : quelle que soit l'indentation recue
 * (y compris le decalage de N espaces ajoute a l'insertion dans la page),
 * la sortie est toujours la meme forme normalisee a la colonne 0.
 * C'est ce qui casse le "creep" d'indentation a chaque build.
 *
 * @param {string} html Fragment HTML (contenu interne d'une balise).
 * @returns {string} HTML reindente, sans espaces de fin ni lignes vides aux bords.
 */
export function formatContent(html) {
    // js-beautify (html) n'est PAS idempotent si l'entree porte deja une
    // indentation : il la "preserve" partiellement au lieu de la recalculer,
    // ce qui produit une sortie differente a chaque passe (le bug d'origine).
    // On met donc chaque ligne a ras gauche AVANT le beautifier : il ne peut
    // alors deduire l'indentation que de la structure des balises. La sortie
    // devient un point fixe, quelle que soit l'indentation recue.
    const flushLeft = html
        .split('\n')
        .map(line => line.replace(/^\s+/, ''))
        .join('\n');

    return htmlBeautify(flushLeft, BEAUTIFY_OPTIONS)
        .split('\n')
        .map(line => line.replace(/\s+$/, ''))
        .join('\n')
        .trim();
}

export { BEAUTIFY_OPTIONS };
