// Enhancement minimal des pages wiki statiques (sommaire livre) : recherche offline.

import { initWikiSearch } from './search.js';

function init() {
    initWikiSearch();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
