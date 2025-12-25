// Section reveal using IntersectionObserver
(function(){
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function initSections() {
        const sections = Array.from(document.querySelectorAll('section'));
        if (!sections.length) return;

        sections.forEach(s => s.classList.add('section-reveal'));

        if (prefersReduced) {
            sections.forEach(s => s.classList.add('in-view'));
            return;
        }

        const cssRoot = getComputedStyle(document.documentElement);
        const sectionDuration = (cssRoot.getPropertyValue('--section-transition-duration') || '820ms').trim();
        const sectionEasing = (cssRoot.getPropertyValue('--section-transition-easing') || 'cubic-bezier(0.22, 1, 0.36, 1)').trim();
        const staggerStep = (cssRoot.getPropertyValue('--section-stagger-step') || '120ms').trim();
        const parseMs = (s) => {
            const n = parseFloat(s);
            return (String(s).indexOf('ms') >= 0) ? n : n * 1000;
        };
        const staggerMs = parseMs(staggerStep);

        sections.forEach(s => {
            const children = Array.from(s.children).filter(n => n.nodeType === 1);
            children.forEach((child) => {
                if (!child.hasAttribute('data-section-initialized')) {
                    child.style.opacity = '0';
                    child.style.transform = 'translateY(28px)';
                    child.style.transition = `opacity ${sectionDuration} ${sectionEasing} 0ms, transform ${sectionDuration} ${sectionEasing} 0ms`;
                    child.setAttribute('data-section-initialized', '1');
                }
            });
        });

        const opts = {
            root: null,
            rootMargin: '0px 0px -30% 0px',
            threshold: 0.05
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const el = entry.target;

                if (entry.isIntersecting) {
                    const children = Array.from(el.children).filter(n => n.nodeType === 1);

                    children.forEach((child, i) => {
                        const delay = `${i * staggerMs}ms`;
                        child.style.transitionDelay = delay;
                        child.style.transition = child.style.transition || `opacity ${sectionDuration} ${sectionEasing} 0ms, transform ${sectionDuration} ${sectionEasing} 0ms`;

                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            child.style.opacity = '1';
                            child.style.transform = 'none';
                        }));
                    });

                    el.classList.add('in-view');

                    document.body.classList.add('is-transitioning');
                    setTimeout(() => document.body.classList.remove('is-transitioning'), 650);

                    setTimeout(() => children.forEach(c => c.style.transitionDelay = ''), 1200 + (children.length * 120));
                } else {
                    el.classList.remove('in-view');
                    Array.from(el.children).forEach(c => c.style.transitionDelay = '');
                }
            });
        }, opts);

        sections.forEach(s => observer.observe(s));

        const isInViewport = el => {
            const r = el.getBoundingClientRect();
            return (r.top < (window.innerHeight || document.documentElement.clientHeight)) && (r.bottom > 0);
        };

        sections.forEach(s => {
            if (isInViewport(s)) {
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    const children = Array.from(s.children).filter(n => n.nodeType === 1);
                    children.forEach((child, i) => child.style.transitionDelay = `${i * 120}ms`);

                    s.classList.add('in-view');

                    document.body.classList.add('is-transitioning');
                    setTimeout(() => document.body.classList.remove('is-transitioning'), 650);

                    setTimeout(() => children.forEach(c => c.style.transitionDelay = ''), 1200 + (children.length * 120));
                }));
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSections);
    } else {
        initSections();
    }

    // Navigation: smooth scroll + active link tracking
    function setupNavJump() {
        const nav = document.querySelector('.main-nav');
        if (!nav) return;

        const links = Array.from(nav.querySelectorAll('a.nav-link'));
        const toggle = nav.querySelector('.nav-toggle');

        nav.addEventListener('click', (e) => {
            const a = e.target.closest('a.nav-link');
            if (!a) return;
            e.preventDefault();
            const id = a.getAttribute('href');
            const target = document.querySelector(id);
            if (!target) return;

            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            try { history.pushState(null, '', id); } catch {}

            if (toggle && nav.classList.contains('open')) {
                nav.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        const trackables = Array.from(document.querySelectorAll('header#general, section'));

        let rafId = null;
        const computeActiveByArea = () => {
            rafId = null;
            const vh = window.innerHeight || document.documentElement.clientHeight;
            let best = null;
            let bestRatio = -1;
            for (const el of trackables) {
                const r = el.getBoundingClientRect();
                const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
                const total = Math.max(1, r.height);
                const ratio = visible / total;
                if (ratio > bestRatio) { bestRatio = ratio; best = el; }
            }
            if (!best) return;
            const id = '#' + best.id;
            links.forEach(l => {
                const match = l.getAttribute('href') === id;
                l.classList.toggle('active', match);
                if (match) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
            });
        };

        const schedule = () => { if (rafId == null) rafId = requestAnimationFrame(computeActiveByArea); };
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        computeActiveByArea();

        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const open = !nav.classList.contains('open');
                nav.classList.toggle('open', open);
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }

        document.addEventListener('click', (e) => {
            if (!nav.classList.contains('open')) return;
            if (!nav.contains(e.target)) {
                nav.classList.remove('open');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && nav.classList.contains('open')) {
                nav.classList.remove('open');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            }
        });

        const breakpoint = 720;
        window.addEventListener('resize', () => {
            if (window.innerWidth > breakpoint && nav.classList.contains('open')) {
                nav.classList.remove('open');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupNavJump);
    } else {
        setupNavJump();
    }
})();

// Automatic language detection and redirection
(function() {
    const currentPath = window.location.pathname;
    const isSkPage = currentPath.includes('/sk/');
    
    // Check if user has a saved language preference
    const savedLang = localStorage.getItem('preferredLanguage');
    
    if (savedLang) {
        // User has a saved preference - respect it
        if (savedLang === 'sk' && !isSkPage) {
            window.location.href = 'sk/index.html';
            return;
        } else if (savedLang === 'en' && isSkPage) {
            window.location.href = '../index.html';
            return;
        }
    } else {
        // No saved preference - use automatic detection
        const userLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
        const isSlovak = userLang.startsWith('sk');
        
        // Redirect to appropriate language if needed
        if (!isSkPage && isSlovak) {
            // User prefers Slovak but is on English page
            localStorage.setItem('preferredLanguage', 'sk');
            window.location.href = 'sk/index.html';
        } else if (isSkPage && !isSlovak) {
            // User doesn't prefer Slovak but is on Slovak page (default to English)
            localStorage.setItem('preferredLanguage', 'en');
            window.location.href = '../index.html';
        } else {
            // Save the current language as preference
            localStorage.setItem('preferredLanguage', isSkPage ? 'sk' : 'en');
        }
    }
})();

// Language selector handler
(function() {
    const languageSelect = document.getElementById('language-select');
    if (!languageSelect) return;

    languageSelect.addEventListener('change', function() {
        const selectedLang = this.value;
        const currentPath = window.location.pathname;
        
        // Save the user's language preference
        localStorage.setItem('preferredLanguage', selectedLang);
        
        if (selectedLang === 'sk' && !currentPath.includes('/sk/')) {
            // Switch to Slovak
            window.location.href = 'sk/index.html';
        } else if (selectedLang === 'en' && currentPath.includes('/sk/')) {
            // Switch to English
            window.location.href = '../index.html';
        }
    });
})();