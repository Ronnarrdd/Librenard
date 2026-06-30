// Lightbox d'image plein ecran. Singleton : l'overlay est cree a la premiere
// image cliquee, puis reutilise. Les listeners globaux (Esc) sont donc
// attaches une seule fois, pas de fuite.

let lightboxEl       = null;
let lightboxImgEl    = null;
let lastFocusedBefore = null;

function ensureLightbox() {
    if (lightboxEl) return lightboxEl;
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'wiki-lightbox';
    lightboxEl.setAttribute('aria-hidden', 'true');
    lightboxEl.setAttribute('role', 'dialog');
    lightboxEl.setAttribute('aria-modal', 'true');
    lightboxEl.setAttribute('aria-label', 'Image agrandie');
    lightboxEl.innerHTML = `
        <button class="wiki-lightbox-close" type="button" aria-label="Fermer">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
        <img class="wiki-lightbox-img" alt="">
    `;
    document.body.appendChild(lightboxEl);
    lightboxImgEl = lightboxEl.querySelector('.wiki-lightbox-img');

    // Clic en dehors de l'image ou sur le bouton de fermeture
    lightboxEl.addEventListener('click', (e) => {
        if (e.target === lightboxEl || e.target.closest('.wiki-lightbox-close')) {
            closeLightbox();
        }
    });

    // Touche Echap ferme, uniquement quand la lightbox est active
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightboxEl.classList.contains('active')) {
            e.preventDefault();
            closeLightbox();
        }
    });

    return lightboxEl;
}

function openLightbox(src, alt, triggerEl) {
    const box = ensureLightbox();
    lightboxImgEl.src = src;
    lightboxImgEl.alt = alt || '';
    lastFocusedBefore = triggerEl || document.activeElement;
    box.classList.add('active');
    box.setAttribute('aria-hidden', 'false');
    // Empeche le scroll arriere-plan pendant l'affichage
    document.documentElement.classList.add('wiki-lightbox-open');
    // Focus sur le bouton fermer pour navigation clavier
    const closeBtn = box.querySelector('.wiki-lightbox-close');
    closeBtn?.focus();
}

function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('active');
    lightboxEl.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('wiki-lightbox-open');
    // Purge l'image apres la transition pour eviter de garder un gros blob en memoire
    setTimeout(() => {
        if (lightboxImgEl && !lightboxEl.classList.contains('active')) {
            lightboxImgEl.removeAttribute('src');
        }
    }, 250);
    // Restaure le focus sur l'element declencheur
    if (lastFocusedBefore && typeof lastFocusedBefore.focus === 'function') {
        lastFocusedBefore.focus();
    }
    lastFocusedBefore = null;
}

// Reconnait les href qui pointent vers un fichier image (avec querystring/fragment
// optionnels). Bookstack enveloppe chaque image dans un <a> vers la version
// pleine resolution : on veut intercepter ces liens-la pour la lightbox.
const IMAGE_HREF_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?|#|$)/i;

export function setupImageLightbox(articleBody) {
    articleBody.querySelectorAll('img').forEach(img => {
        const wrappingLink = img.closest('a');
        if (wrappingLink) {
            const href = wrappingLink.getAttribute('href') || '';
            // Cas courant Bookstack : <a href="full-res.png"><img src="thumb.png"/></a>
            // -> on intercepte le clic et on affiche le full-res en lightbox.
            if (IMAGE_HREF_RE.test(href)) {
                img.classList.add('wiki-zoomable');
                wrappingLink.addEventListener('click', (e) => {
                    // Respecte les interactions de navigation avancee : Ctrl/Cmd-clic
                    // (nouvel onglet), Shift-clic (nouvelle fenetre), clic milieu.
                    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
                    e.preventDefault();
                    openLightbox(href, img.alt, img);
                });
                return;
            }
            // Lien vers autre chose (page, ancre, externe non-image) : on respecte.
            return;
        }
        // Image libre sans lien parent : elle devient elle-meme cliquable
        img.classList.add('wiki-zoomable');
        img.setAttribute('tabindex', '0');
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', img.alt ? `Agrandir l'image : ${img.alt}` : 'Agrandir l\'image');
        img.addEventListener('click', () => {
            openLightbox(img.currentSrc || img.src, img.alt, img);
        });
        img.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLightbox(img.currentSrc || img.src, img.alt, img);
            }
        });
    });
}
