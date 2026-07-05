// Mode "Police adaptee a la dyslexie" (OpenDyslexic, hebergee localement).
// Charge la police a la demande, persiste l'etat dans localStorage,
// affiche un bouton flottant uniquement quand une zone wiki est presente.

import { assetUrl } from './site-paths.js';

const DYSLEXIC_STORAGE_KEY = 'wiki-dyslexic';

function loadDyslexicFont() {
    if (document.getElementById('opendyslexic-stylesheet')) return;
    const link = document.createElement('link');
    link.id = 'opendyslexic-stylesheet';
    link.rel = 'stylesheet';
    link.href = assetUrl('vendor/fonts/opendyslexic.css');
    document.head.appendChild(link);
}

function setDyslexicMode(enabled, { save = true } = {}) {
    if (enabled) {
        loadDyslexicFont();
        document.documentElement.classList.add('dyslexic-font');
    } else {
        document.documentElement.classList.remove('dyslexic-font');
    }
    if (save) {
        try {
            localStorage.setItem(DYSLEXIC_STORAGE_KEY, enabled ? 'on' : 'off');
        } catch (_) {}
    }
    const btn = document.getElementById('dyslexic-toggle');
    if (btn) {
        btn.classList.toggle('active', enabled);
        btn.setAttribute('aria-pressed', String(enabled));
    }
}

function createDyslexicToggle() {
    // N'affiche le bouton que sur les surfaces de lecture du wiki :
    // section interactive (SPA) ou article prerendu au build.
    if (!document.getElementById('wiki-view') && !document.querySelector('.wiki-article-body')) return;
    if (document.getElementById('dyslexic-toggle')) return;

    const btn = document.createElement('button');
    btn.id = 'dyslexic-toggle';
    btn.className = 'dyslexic-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Police adaptée à la dyslexie (OpenDyslexic)');
    btn.setAttribute('title', 'Police adaptée à la dyslexie (OpenDyslexic)');
    btn.innerHTML = '<span aria-hidden="true">Aa</span>';

    const enabled = document.documentElement.classList.contains('dyslexic-font');
    btn.classList.toggle('active', enabled);
    btn.setAttribute('aria-pressed', String(enabled));

    btn.addEventListener('click', () => {
        const next = !document.documentElement.classList.contains('dyslexic-font');
        setDyslexicMode(next);
    });

    document.body.appendChild(btn);
}

export function initDyslexicMode() {
    try {
        if (localStorage.getItem(DYSLEXIC_STORAGE_KEY) === 'on') {
            setDyslexicMode(true, { save: false });
        }
    } catch (_) {}
    createDyslexicToggle();
}
