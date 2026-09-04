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
            rootMargin: '0px 0px -24% 0px',
            threshold: 0.08
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

                    setTimeout(() => children.forEach(c => {
                        c.style.transitionDelay = '';
                        c.style.opacity = '';
                        c.style.transform = '';
                    }), 1200 + (children.length * 120));
                } else {
                    el.classList.remove('in-view');
                    Array.from(el.children).forEach(c => {
                        c.style.transitionDelay = '';
                        c.style.opacity = '';
                        c.style.transform = '';
                    });
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

                    setTimeout(() => children.forEach(c => {
                        c.style.transitionDelay = '';
                        c.style.opacity = '';
                        c.style.transform = '';
                    }), 1200 + (children.length * 120));
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

        let jumpTimer = null;
        function playSectionJump(target) {
            if (prefersReduced) return;
            if (!target) return;
            target.classList.remove('section-arriving');
            void target.offsetWidth;
            clearTimeout(jumpTimer);
            jumpTimer = setTimeout(() => {
                target.classList.add('section-arriving');
                jumpTimer = setTimeout(() => target.classList.remove('section-arriving'), 720);
            }, 220);
        }

        nav.addEventListener('click', (e) => {
            const a = e.target.closest('a.nav-link');
            if (!a) return;
            e.preventDefault();
            const id = a.getAttribute('href');
            const target = document.querySelector(id);
            if (!target) return;

            playSectionJump(target);
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

    function setupCardInteractions() {
        if (prefersReduced || !window.matchMedia('(hover: hover)').matches) return;

        const cards = Array.from(document.querySelectorAll('.career-card, .service-item'));
        cards.forEach(card => {
            card.addEventListener('pointermove', (event) => {
                const rect = card.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                const maxTilt = card.classList.contains('service-item') ? 3.5 : 7;
                card.style.setProperty('--tilt-x', `${(-y * maxTilt).toFixed(2)}deg`);
                card.style.setProperty('--tilt-y', `${(x * maxTilt).toFixed(2)}deg`);
            });

            card.addEventListener('pointerleave', () => {
                card.style.setProperty('--tilt-x', '0deg');
                card.style.setProperty('--tilt-y', '0deg');
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupCardInteractions);
    } else {
        setupCardInteractions();
    }
})();

/* Image protection: wrap imgs with overlay and block contextmenu/drag */
(function(){
    function protectImages() {
        const imgs = Array.from(document.querySelectorAll('img'));
        imgs.forEach(img => {
            if (img.closest('.protect-img-wrapper')) return; // already wrapped
            try {
                img.setAttribute('draggable', 'false');
                img.style.userSelect = 'none';

                const wrapper = document.createElement('span');
                wrapper.className = 'protect-img-wrapper';
                img.parentNode.insertBefore(wrapper, img);
                wrapper.appendChild(img);

                const overlay = document.createElement('span');
                overlay.className = 'protect-overlay';
                wrapper.appendChild(overlay);

                // block context menu and mouse interactions on the overlay
                overlay.addEventListener('contextmenu', e => e.preventDefault());
                overlay.addEventListener('mousedown', e => e.preventDefault());
                img.addEventListener('dragstart', e => e.preventDefault());
            } catch (err) {
                // ignore
            }
        });

        // capture contextmenu events on images as a fallback
        document.addEventListener('contextmenu', function(e){
            if (e.target && e.target.closest && e.target.closest('.protect-img-wrapper')) {
                e.preventDefault();
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', protectImages);
    } else {
        protectImages();
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

// Language selector handler (desktop and mobile instances)
(function() {
    const selects = document.querySelectorAll('.language-selector select');
    if (!selects.length) return;

    function onChange() {
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
    }

    selects.forEach(sel => sel.addEventListener('change', onChange));
})();

// Periodic email prompt dialog next to floating email icon
(function() {
    const MESSAGE_DELAY_MS = 10 * 1000; // 10 seconds
    const MESSAGE_INTERVAL_MS = 120 * 1000; // every 120 seconds
    const EMAIL = 'julia.gasanova.eu@gmail.com';

    function getCurrentLanguage() {
        const desktop = document.getElementById('language-select');
        const mobile = document.getElementById('language-select-mobile');
        const current = desktop || mobile;

        if (current && (current.value === 'en' || current.value === 'sk')) {
            return current.value;
        }

        const saved = localStorage.getItem('preferredLanguage');
        if (saved === 'sk' || saved === 'en') {
            return saved;
        }

        return window.location.pathname.includes('/sk/') ? 'sk' : 'en';
    }

    function getMessageHtml(lang) {
        if (lang === 'sk') {
            return 'Máte otázky alebo podnety? <a href="mailto:' + EMAIL + '">Neváhajte ma kontaktovať</a>.';
        }
        return 'Any questions or insights to share? <a href="mailto:' + EMAIL + '">Feel free to reach out</a>.';
    }

    function createPopup() {
        let popup = document.querySelector('.email-popup');

        if (!popup) {
            popup = document.createElement('div');
            popup.className = 'email-popup';
            popup.setAttribute('role', 'dialog');
            popup.setAttribute('aria-live', 'polite');
            popup.setAttribute('aria-label', 'Email prompt');

            const closeBtn = document.createElement('button');
            closeBtn.className = 'email-popup-close';
            closeBtn.type = 'button';
            closeBtn.setAttribute('aria-label', 'Close email prompt');
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', () => {
                hidePopup(popup);
            });

            const text = document.createElement('span');
            text.className = 'email-popup-text';
            popup.appendChild(closeBtn);
            popup.appendChild(text);
            document.body.appendChild(popup);
        }

        return popup;
    }

    function showPopup() {
        const popup = createPopup();
        const messageSpan = popup.querySelector('.email-popup-text');
        if (messageSpan) {
            const lang = getCurrentLanguage();
            messageSpan.innerHTML = getMessageHtml(lang);
        }

        popup.classList.add('visible');

        clearTimeout(popup.dismissTimeout);
        popup.dismissTimeout = setTimeout(() => hidePopup(popup), 12000);
    }

    function hidePopup(popup) {
        if (!popup) return;
        popup.classList.remove('visible');
        clearTimeout(popup.dismissTimeout);
    }

    function initPopupScheduler() {
        setTimeout(() => {
            showPopup();
            setInterval(showPopup, MESSAGE_INTERVAL_MS);
        }, MESSAGE_DELAY_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopupScheduler);
    } else {
        initPopupScheduler();
    }
})();

// Navigation background toggling removed – styles remain consistent at top and scrolled
// (left in case additional scroll behavior is added later)
