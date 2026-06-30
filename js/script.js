document.addEventListener('DOMContentLoaded', () => {
    // Detection de page active : chaque <body> porte data-page, chaque lien data-nav.
    // Plus robuste que parser l'URL (tolere les query strings, le serving en "/", etc.).
    const currentPage = document.body.dataset.page;
    if (currentPage) {
        document.querySelectorAll('.navbar-links a[data-nav]').forEach(link => {
            if (link.dataset.nav === currentPage) link.classList.add('active');
        });
    }

    const burgerBtn = document.querySelector('.burger-menu');
    const navList = document.querySelector('.navbar-links');

    if (burgerBtn && navList) {
        burgerBtn.addEventListener('click', () => {
            const open = navList.classList.toggle('active');
            burgerBtn.innerHTML = open ? '✕' : '☰';
            burgerBtn.setAttribute('aria-expanded', String(open));
        });
    }

    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.setAttribute('aria-label', 'Basculer le thème');
    document.body.appendChild(themeToggle);

    const root = document.documentElement;
    const isDark = () => root.classList.contains('dark-mode');
    const updateToggleIcon = () => {
        const dark = isDark();
        themeToggle.innerHTML = dark ? '☀️' : '🌙';
        themeToggle.setAttribute('aria-pressed', String(dark));
    };

    updateToggleIcon();

    themeToggle.addEventListener('click', () => {
        root.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark() ? 'dark' : 'light');
        updateToggleIcon();
    });

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { root: null, rootMargin: '0px', threshold: 0.1 });

    const fadeElements = document.querySelectorAll('.hero, .feature-card, .section, .card, .cta-section');
    fadeElements.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });

    const backToTop = document.createElement('button');
    backToTop.className = 'back-to-top';
    backToTop.setAttribute('aria-label', 'Retour en haut de la page');
    backToTop.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
    document.body.appendChild(backToTop);

    const toggleBackToTop = () => {
        if (window.scrollY > 400) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    };

    window.addEventListener('scroll', toggleBackToTop, { passive: true });
    toggleBackToTop();

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
