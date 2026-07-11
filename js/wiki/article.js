// Tout ce qui touche a la lecture d'un article :
//  - colorisation syntaxique (highlight.js, lazy-loaded)
//  - bouton "Copier" sur les blocs de code
//  - permaliennes "#" sur les titres
//  - table des matieres laterale + observer de scroll
//  - barre de progression de lecture
//  - estimation du temps de lecture (article + livre entier)

import { escapeHtml, slugify } from './helpers.js';
import { flattenPages, getPage } from './api.js';
import { assetUrl } from './site-paths.js';

// ---------- COLORISATION SYNTAXIQUE (highlight.js, heberge localement) ----------

let hljsPromise = null;

function ensureHighlighter() {
    if (hljsPromise) return hljsPromise;
    hljsPromise = new Promise((resolve, reject) => {
        if (!document.getElementById('hljs-theme')) {
            const link = document.createElement('link');
            link.id   = 'hljs-theme';
            link.rel  = 'stylesheet';
            link.href = assetUrl('vendor/highlight/atom-one-dark.min.css');
            document.head.appendChild(link);
        }
        const script = document.createElement('script');
        script.src    = assetUrl('vendor/highlight/highlight.min.js');
        script.async  = true;
        script.onload = () => resolve(window.hljs);
        script.onerror = () => {
            hljsPromise = null;
            reject(new Error('Chargement de highlight.js echoue'));
        };
        document.head.appendChild(script);
    });
    return hljsPromise;
}

// Noms "jolis" pour l'etiquette affichee au-dessus du bloc
const LANG_LABELS = {
    js: 'JavaScript', javascript: 'JavaScript',
    ts: 'TypeScript', typescript: 'TypeScript',
    py: 'Python', python: 'Python',
    rb: 'Ruby', ruby: 'Ruby',
    sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
    ps: 'PowerShell', ps1: 'PowerShell', powershell: 'PowerShell',
    cpp: 'C++', 'c++': 'C++',
    cs: 'C#', csharp: 'C#',
    md: 'Markdown', markdown: 'Markdown',
    yml: 'YAML', yaml: 'YAML',
    json: 'JSON', xml: 'XML', html: 'HTML',
    css: 'CSS', scss: 'SCSS', sass: 'Sass',
    sql: 'SQL', ini: 'INI', toml: 'TOML',
    dockerfile: 'Dockerfile', docker: 'Dockerfile',
    nginx: 'Nginx', apache: 'Apache',
    plaintext: 'Texte', txt: 'Texte'
};

function prettifyLanguage(lang) {
    if (!lang) return '';
    const key = lang.toLowerCase();
    return LANG_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

// Ajoute un bouton "Copier" dans un <pre> donne. Idempotent : n'ajoute rien
// si un bouton est deja present. Marche independamment de highlight.js.
function addCopyButton(pre, code) {
    if (!pre || !code || pre.querySelector('.wiki-copy-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wiki-copy-btn';
    btn.setAttribute('aria-label', 'Copier le code');
    btn.innerHTML = `
        <svg class="wiki-copy-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span class="wiki-copy-label">Copier</span>
    `;
    let resetTimer = null;
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(code.textContent);
        } catch (_) {
            // Navigator.clipboard peut echouer hors HTTPS ou si refus utilisateur :
            // on n'empeche pas le feedback visuel, mais on signale discretement
            btn.classList.add('error');
            btn.querySelector('.wiki-copy-label').textContent = 'Echec';
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                btn.classList.remove('error');
                btn.querySelector('.wiki-copy-label').textContent = 'Copier';
            }, 1800);
            return;
        }
        btn.classList.add('copied');
        btn.querySelector('.wiki-copy-label').textContent = 'Copié';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            btn.classList.remove('copied');
            btn.querySelector('.wiki-copy-label').textContent = 'Copier';
        }, 1500);
    });
    pre.appendChild(btn);
}

export async function highlightArticleCode(articleBody) {
    const blocks = articleBody.querySelectorAll('pre > code');
    if (!blocks.length) return;

    // Bouton "Copier" ajoute avant toute colorisation : il ne depend pas de hljs,
    // et reste utilisable meme si la lib ne se charge pas (reseau, CSP, etc.).
    blocks.forEach(block => addCopyButton(block.parentElement, block));

    let hljs;
    try {
        hljs = await ensureHighlighter();
    } catch (err) {
        console.warn('[wiki]', err);
        return;
    }
    blocks.forEach(block => {
        try {
            hljs.highlightElement(block);
        } catch (err) {
            console.warn('[wiki] colorisation echouee :', err);
            return;
        }
        // Recupere le langage (soit defini par Bookstack, soit detecte par hljs)
        const langClass = [...block.classList].find(c => c.startsWith('language-') && c !== 'language-undefined');
        const pre = block.parentElement;
        if (pre && langClass) {
            pre.dataset.language = prettifyLanguage(langClass.replace('language-', ''));
        }
    });
}

// ---------- TEMPS DE LECTURE + BARRE DE PROGRESSION ----------

// eslint-disable-next-line no-unused-vars
function estimateReadingMinutes(articleBody) {
    const text = (articleBody?.textContent || '').trim();
    if (!text) return 1;
    const words = text.split(/\s+/).filter(Boolean).length;
    // ~220 mots/min, lecture francaise moyenne
    return Math.max(1, Math.round(words / 220));
}

// Compte les mots d'un HTML sans le parser dans le DOM principal (pas d'effet de bord).
function wordCountFromHtml(html) {
    if (!html) return 0;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = (tmp.textContent || '').trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
}

// Agrege le temps de lecture d'un livre en fetchant ses pages en parallele.
// Les pages fetchees peuplent au passage le cache, ce qui accelere l'ouverture ulterieure.
export async function computeBookReadingMinutes(book) {
    const pages = flattenPages(book);
    if (!pages.length) return { minutes: 0, pageCount: 0 };

    const results = await Promise.allSettled(pages.map(p => getPage(p.id)));
    let totalWords = 0;
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
            totalWords += wordCountFromHtml(r.value.html);
        }
    }
    const minutes = Math.max(1, Math.round(totalWords / 220));
    return { minutes, pageCount: pages.length };
}

let progressBarEl        = null;
let progressScrollTarget = null;
let progressTicking      = false;

function ensureProgressBar() {
    if (progressBarEl) return progressBarEl;
    const existing = document.getElementById('reading-progress');
    if (existing) { progressBarEl = existing; return existing; }
    const el = document.createElement('div');
    el.id = 'reading-progress';
    el.className = 'reading-progress';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="reading-progress-fill"></div>';
    document.body.appendChild(el);
    progressBarEl = el;
    return el;
}

function updateProgress() {
    progressTicking = false;
    if (!progressBarEl || !progressScrollTarget || !progressScrollTarget.isConnected) return;
    const rect   = progressScrollTarget.getBoundingClientRect();
    const scrollY = window.scrollY;
    const vh     = window.innerHeight;
    const topAbs = rect.top + scrollY;
    const height = progressScrollTarget.offsetHeight;
    // on considere "lu" quand le bas du viewport depasse le bas de l'article
    const raw    = (scrollY + vh - topAbs) / height;
    const clamped = Math.max(0, Math.min(1, raw));
    const fill = progressBarEl.firstElementChild;
    if (fill) fill.style.transform = `scaleX(${clamped})`;
}

function onProgressScroll() {
    if (progressTicking) return;
    progressTicking = true;
    requestAnimationFrame(updateProgress);
}

export function startReadingProgress(articleBody) {
    // Garantit qu'on n'attache jamais deux fois les listeners en cas de double router()
    stopReadingProgress();
    const bar = ensureProgressBar();
    bar.classList.add('active');
    progressScrollTarget = articleBody;
    window.addEventListener('scroll', onProgressScroll, { passive: true });
    window.addEventListener('resize', onProgressScroll, { passive: true });
    updateProgress();
}

export function stopReadingProgress() {
    if (progressBarEl) progressBarEl.classList.remove('active');
    window.removeEventListener('scroll', onProgressScroll);
    window.removeEventListener('resize', onProgressScroll);
    progressScrollTarget = null;
}

// ---------- TABLE DES MATIERES (TOC) ----------

let currentTocObserver = null;

export function buildToc(articleBody) {
    const headings = articleBody.querySelectorAll('h2, h3');
    if (!headings.length) return [];

    const used = new Set();
    const items = [];

    headings.forEach((h, i) => {
        let id = h.id;
        if (!id) {
            const base = slugify(h.textContent) || `section-${i}`;
            id = base;
            let n = 1;
            while (used.has(id) || articleBody.querySelector(`[id="${CSS.escape(id)}"]`)) {
                id = `${base}-${n++}`;
            }
            h.id = id;
        }
        used.add(id);

        items.push({
            id,
            text: h.textContent,
            level: h.tagName === 'H3' ? 3 : 2,
            element: h
        });
    });

    return items;
}

// Injecte une ancre "#" en premier enfant de chaque h2/h3 de l'article.
// Doit etre appele APRES buildToc (qui garantit que chaque heading a un id) et
// idealement APRES l'extraction du textContent pour la TOC laterale (pour que
// le "#" ne se retrouve pas dans les libelles TOC).
export function setupHeadingAnchors(articleBody, bookSlug, pageSlug) {
    const headings = articleBody.querySelectorAll('h2, h3');
    headings.forEach(h => {
        if (!h.id || h.querySelector('.wiki-heading-anchor')) return;
        const anchor = document.createElement('a');
        anchor.className = 'wiki-heading-anchor';
        anchor.href = `#/book/${encodeURIComponent(bookSlug)}/page/${encodeURIComponent(pageSlug)}/h/${encodeURIComponent(h.id)}`;
        anchor.setAttribute('aria-label', 'Copier le lien vers cette section');
        anchor.textContent = '#';
        let resetTimer = null;
        anchor.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fullUrl = `${location.origin}${location.pathname}${anchor.getAttribute('href')}`;
            try {
                await navigator.clipboard.writeText(fullUrl);
            } catch (_) {
                // Pas grave : on continue a scroller, juste sans copie
            }
            // Scroll doux vers le titre, mais on ne touche PAS a location.hash
            // (eviterait un re-run du router + flash de rechargement de la page)
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            anchor.classList.add('copied');
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => anchor.classList.remove('copied'), 1400);
        });
        h.insertBefore(anchor, h.firstChild);
    });
}

// Permaliennes sur les pages statiques prerendues : l'URL copiee inclut le
// chemin wiki/<livre>/<article>.html#<section> (meta OpenGraph du contenu).
export function setupStaticHeadingAnchors(articleBody) {
    const headings = articleBody.querySelectorAll('h2, h3');
    headings.forEach(h => {
        if (!h.id || h.querySelector('.wiki-heading-anchor')) return;
        const anchor = document.createElement('a');
        anchor.className = 'wiki-heading-anchor';
        anchor.href = `#${encodeURIComponent(h.id)}`;
        anchor.setAttribute('aria-label', 'Copier le lien vers cette section');
        anchor.textContent = '#';
        let resetTimer = null;
        anchor.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fullUrl = `${location.origin}${location.pathname}${anchor.getAttribute('href')}`;
            try {
                await navigator.clipboard.writeText(fullUrl);
            } catch (_) {}
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            anchor.classList.add('copied');
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => anchor.classList.remove('copied'), 1400);
        });
        h.insertBefore(anchor, h.firstChild);
    });
}

export function renderTocSidebar(items) {
    if (!items || items.length < 2) return '';
    const links = items.map(item => `
        <li class="wiki-toc-side-item wiki-toc-side-level-${item.level}">
            <a href="#${item.id}" data-toc-link="${item.id}">${escapeHtml(item.text)}</a>
        </li>
    `).join('');
    return `
        <aside class="wiki-toc-sidebar" aria-label="Table des matières">
            <p class="wiki-toc-side-title">Sur cette page</p>
            <ul class="wiki-toc-side-list">${links}</ul>
        </aside>
    `;
}

export function setupTocObserver(items, container) {
    if (currentTocObserver) {
        currentTocObserver.disconnect();
        currentTocObserver = null;
    }
    if (!items.length) return;

    const links = {};
    items.forEach(item => {
        const link = container.querySelector(`[data-toc-link="${item.id}"]`);
        if (link) links[item.id] = link;
    });

    function setActive(id) {
        Object.entries(links).forEach(([linkId, link]) => {
            link.classList.toggle('active', linkId === id);
        });
    }

    // Active par defaut la premiere
    setActive(items[0].id);

    currentTocObserver = new IntersectionObserver((entries) => {
        // On repere les titres dans la "zone active" (haut de viewport)
        const intersecting = entries
            .filter(e => e.isIntersecting)
            .map(e => e.target);
        if (intersecting.length) {
            // Prend celui le plus haut dans le viewport (comparaison absolue, independante
            // du parent positionne, contrairement a offsetTop).
            const topMost = intersecting.reduce((best, el) => {
                if (!best) return el;
                return el.getBoundingClientRect().top < best.getBoundingClientRect().top ? el : best;
            }, null);
            if (topMost) setActive(topMost.id);
        }
    }, {
        // Active quand le titre passe dans le 1er tiers superieur du viewport
        rootMargin: '-90px 0px -70% 0px',
        threshold: 0
    });

    items.forEach(item => currentTocObserver.observe(item.element));

    // Clic sur un lien -> scroll anime (on ne touche pas au hash, routage SPA).
    // Delegation unique sur le container : un seul listener, pas de rebind a chaque rendu.
    container.addEventListener('click', (e) => {
        const link = e.target.closest('[data-toc-link]');
        if (!link || !container.contains(link)) return;
        const targetId = link.getAttribute('href').slice(1);
        // Les TOC prerendues (pages statiques) encodent le href pour que
        // l'ancre native fonctionne : on decode pour retrouver l'id literal.
        let target = document.getElementById(targetId);
        if (!target) {
            try { target = document.getElementById(decodeURIComponent(targetId)); } catch (_) { /* href malformee */ }
        }
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActive(targetId);
    });
}

export function disconnectTocObserver() {
    if (currentTocObserver) {
        currentTocObserver.disconnect();
        currentTocObserver = null;
    }
}
