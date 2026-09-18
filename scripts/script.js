/* ==========================================================================
   scripts/script.js  (shared by index.html and sk/index.html)

   1. Shared helpers and settings
   2. Language: page fade, automatic redirect + language selector
   3. Page layers: measuring, sticky stacking, project sorting,
      keeping the scroll position when the language changes
   4. Navigation: smooth jumps, active link, mobile menu
   5. Motion: headline + scroll reveal, layer effects, hero effects, timeline,
      metric count-up, card tilt
   6. Image protection
   7. Email prompt
   8. Start-up

   The site works without this file. Everything in sections 3-5 is progressive
   enhancement: it only adds classes / CSS variables that the stylesheet uses.
   ========================================================================== */

(function () {
    'use strict';

    /* ======================================================================
       1. SHARED HELPERS AND SETTINGS
       ====================================================================== */

    // Switches for the scrolling effects (set to false to turn one off)
    const ENABLE_STACKING = true;        // sheets slide over each other on wide screens
    const ENABLE_RECEDING = true;        // the covered sheet shrinks and darkens slightly
    const ENABLE_EDGE_LIGHT = true;      // orange light along a sheet's top edge as it arrives
    const ENABLE_HEADING_REVEAL = true;  // section titles rise word by word

    const LANG_KEY = 'preferredLanguage';
    const POSITION_KEY = 'languageSwitchPosition';
    const EMAIL = 'julia.gasanova.eu@gmail.com';

    // Must match the breakpoints in style.css and the <noscript> blocks
    const COMPACT_NAV_QUERY = '(max-width: 1000px)';
    const STACK_QUERY = '(min-width: 1001px) and (prefers-reduced-motion: no-preference)';
    const PARALLAX_QUERY = '(min-width: 769px)';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover = window.matchMedia('(hover: hover)').matches;
    const compactNavMedia = window.matchMedia(COMPACT_NAV_QUERY);
    const stackMedia = window.matchMedia(STACK_QUERY);
    const parallaxMedia = window.matchMedia(PARALLAX_QUERY);

    const isSlovakPage = window.location.pathname.includes('/sk/');

    // Weak or battery-saving devices skip the one effect that repaints large areas
    const connection = navigator.connection || {};
    const isLowPower = connection.saveData === true ||
        (navigator.deviceMemory || 8) <= 2 ||
        (navigator.hardwareConcurrency || 8) <= 2;

    function onReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function listen(mediaQuery, callback) {
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', callback);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(callback); // older Safari
        }
    }

    // Web storage can throw (private mode, blocked cookies) - never let it break the page
    function createStorage(name) {
        return {
            get(key) {
                try { return window[name].getItem(key); } catch (e) { return null; }
            },
            set(key, value) {
                try { window[name].setItem(key, value); return true; } catch (e) { return false; }
            },
            remove(key) {
                try { window[name].removeItem(key); } catch (e) { /* ignore */ }
            }
        };
    }

    const storage = createStorage('localStorage');          // language choice (kept)
    const sessionData = createStorage('sessionStorage');    // scroll position (one page switch)

    // Sets a CSS variable only when its value changed (avoids needless style recalculation)
    const lastVarValues = new WeakMap();

    function setVar(element, name, value) {
        let values = lastVarValues.get(element);
        if (!values) {
            values = {};
            lastVarValues.set(element, values);
        }
        if (values[name] === value) return;
        values[name] = value;
        element.style.setProperty(name, value);
    }

    // Same idea for inline styles (opacity, transform, ...)
    function setStyle(element, property, value) {
        if (element.style[property] !== value) element.style[property] = value;
    }

    // One requestAnimationFrame loop shared by everything that reacts to scroll / resize.
    // A task reads first and may return a function that does its writes; all reads of a
    // frame run before any write, so the browser never has to recalculate layout twice.
    const frameTasks = [];
    let framePending = false;

    function runFrameTasks() {
        framePending = false;
        const writes = frameTasks.map(task => task());
        writes.forEach(write => { if (write) write(); });
    }

    function requestFrame() {
        if (framePending) return;
        framePending = true;
        window.requestAnimationFrame(runFrameTasks);
    }

    function onFrame(task) {
        frameTasks.push(task);
        const write = task();
        if (write) write();
    }


    /* ======================================================================
       2. LANGUAGE
       ====================================================================== */

    // Switching language: the page fades out (CSS, section 19), then the other page opens
    // and fades in by itself. LEAVE_MS must match the fade-out time in style.css.
    const LEAVE_MS = 200;

    function openLanguagePage(url) {
        rememberPosition();

        if (prefersReducedMotion) {
            window.location.href = url;
            return;
        }
        document.documentElement.classList.add('is-leaving');
        window.setTimeout(() => { window.location.href = url; }, LEAVE_MS);
    }

    // Back/forward can restore a page from memory - make sure it is not left faded out
    function initPageFade() {
        window.addEventListener('pageshow', event => {
            if (event.persisted) document.documentElement.classList.remove('is-leaving');
        });
    }

    function initLanguageRedirect() {
        const current = isSlovakPage ? 'sk' : 'en';
        const saved = storage.get(LANG_KEY);
        let wanted = saved === 'sk' || saved === 'en' ? saved : null;

        if (!wanted) {
            const browserLanguage = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
            const detected = browserLanguage.startsWith('sk') ? 'sk' : 'en';

            // Without working storage a choice could not be remembered and the
            // browser language would keep overriding it, so stay on this page.
            if (!storage.set(LANG_KEY, detected)) return;
            wanted = detected;
        }

        if (wanted !== current) {
            window.location.replace((wanted === 'sk' ? 'sk/index.html' : '../index.html') + window.location.hash);
        }
    }

    function initLanguageSelector() {
        document.querySelectorAll('.language-selector select').forEach(select => {
            select.addEventListener('change', () => {
                const chosen = select.value;
                storage.set(LANG_KEY, chosen);

                if (chosen === 'sk' && !isSlovakPage) {
                    openLanguagePage('sk/index.html');
                } else if (chosen === 'en' && isSlovakPage) {
                    openLanguagePage('../index.html');
                }
            });
        });
    }

    function getCurrentLanguage() {
        const select = document.getElementById('language-select') || document.getElementById('language-select-mobile');
        if (select && (select.value === 'en' || select.value === 'sk')) return select.value;

        const saved = storage.get(LANG_KEY);
        if (saved === 'sk' || saved === 'en') return saved;

        return isSlovakPage ? 'sk' : 'en';
    }


    /* ======================================================================
       3. PAGE LAYERS
       The hero and every <section> are "layers". Their natural (unstuck)
       top positions are measured here; navigation uses them so it keeps
       working while layers are sticky.
       ====================================================================== */

    const layers = [];
    const layerTops = [];      // natural document top of each layer
    const layerHeights = [];
    const stackTops = [];      // where each layer pins while sticky (<= 0)
    let measurePending = false;

    function sortProjectsByDate() {
        const projectSection = document.querySelector('#projects');
        if (!projectSection) return;

        const startYear = card => Number.parseInt(card.querySelector('.date')?.textContent || '', 10) || 0;

        Array.from(projectSection.querySelectorAll(':scope > .project-card'))
            .sort((a, b) => startYear(b) - startYear(a))
            .forEach(card => projectSection.appendChild(card));
    }

    function measureLayers() {
        measurePending = false;

        const viewportHeight = window.innerHeight;
        let top = 0;

        layers.forEach((layer, index) => {
            top += parseFloat(window.getComputedStyle(layer).marginTop) || 0;
            layerTops[index] = top;

            const height = layer.offsetHeight;
            // Tall layers pin when their bottom edge reaches the viewport bottom,
            // short ones pin at the top (only used while html.stack-on is set).
            layerHeights[index] = height;
            stackTops[index] = Math.min(0, viewportHeight - height);
            setVar(layer, '--stack-top', stackTops[index] + 'px');
            top += height;
        });
    }

    function scheduleMeasure() {
        if (measurePending) return;
        measurePending = true;
        window.requestAnimationFrame(measureLayers);
    }

    // The layer that holds the reading line (a little above the middle of the screen)
    function getActiveLayerIndex() {
        const readingLine = window.scrollY + window.innerHeight * 0.35;
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        let activeIndex = 0;

        layerTops.forEach((top, index) => {
            if (top <= readingLine) activeIndex = index;
        });
        return atBottom ? layers.length - 1 : activeIndex;
    }

    // Language switch: remember where in the page the visitor is ...
    function rememberPosition() {
        if (!layers.length) return;

        const index = getActiveLayerIndex();
        sessionData.set(POSITION_KEY, JSON.stringify({
            id: layers[index].id,
            ratio: (window.scrollY - layerTops[index]) / (layerHeights[index] || 1),
            time: Date.now()
        }));
    }

    // ... and scroll back to the same spot on the other language's page
    function restorePosition() {
        const raw = sessionData.get(POSITION_KEY);
        if (!raw) return;
        sessionData.remove(POSITION_KEY);

        let saved;
        try { saved = JSON.parse(raw); } catch (e) { return; }

        const index = layers.findIndex(layer => layer.id === saved.id);
        if (index < 0 || !(Date.now() - saved.time < 15000)) return;

        let restoredTop = null;

        function apply() {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            restoredTop = clamp(Math.round(layerTops[index] + saved.ratio * layerHeights[index]), 0, maxScroll);
            window.scrollTo({ top: restoredTop, behavior: 'instant' });
        }

        apply();

        // Images and fonts can still change the page height; correct once, unless the visitor already moved
        window.addEventListener('load', () => {
            measureLayers();
            if (Math.abs(window.scrollY - restoredTop) < 3) apply();
        });
    }

    function updateStackMode() {
        document.documentElement.classList.toggle('stack-on', ENABLE_STACKING && stackMedia.matches);
    }

    function initLayers() {
        sortProjectsByDate();

        const hero = document.querySelector('.hero');
        if (hero) layers.push(hero);
        document.querySelectorAll('section').forEach(section => layers.push(section));

        measureLayers();
        updateStackMode();
        listen(stackMedia, updateStackMode);
        restorePosition();

        window.addEventListener('resize', scheduleMeasure);
        window.addEventListener('load', scheduleMeasure);

        if ('ResizeObserver' in window) {
            const observer = new ResizeObserver(scheduleMeasure);
            layers.forEach(layer => observer.observe(layer));
        }
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleMeasure);
        }
    }


    /* ======================================================================
       4. NAVIGATION
       ====================================================================== */

    function initNavigation() {
        const nav = document.querySelector('.main-nav');
        if (!nav) return;

        const links = Array.from(nav.querySelectorAll('a.nav-link'));
        const toggle = nav.querySelector('.nav-toggle');

        function setMenuOpen(open) {
            nav.classList.toggle('open', open);
            if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        function jumpTo(hash) {
            const target = document.querySelector(hash);
            if (!target) return false;

            const index = layers.indexOf(target);
            const top = index >= 0 ? layerTops[index] : target.getBoundingClientRect().top + window.scrollY;

            window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            try { window.history.pushState(null, '', hash); } catch (e) { /* ignore */ }
            return true;
        }

        nav.addEventListener('click', event => {
            const link = event.target.closest('a.nav-link');
            if (!link || !link.getAttribute('href').startsWith('#')) return;

            if (jumpTo(link.getAttribute('href'))) {
                event.preventDefault();
                setMenuOpen(false);
            }
        });

        // Highlight the link of the layer that currently holds the reading line
        let shownIndex = -1;

        onFrame(() => {
            if (!layers.length) return;

            const activeIndex = getActiveLayerIndex();
            if (activeIndex === shownIndex) return;

            return () => {
                shownIndex = activeIndex;
                const activeHash = '#' + layers[activeIndex].id;

                links.forEach(link => {
                    const isActive = link.getAttribute('href') === activeHash;
                    link.classList.toggle('active', isActive);
                    if (isActive) link.setAttribute('aria-current', 'page');
                    else link.removeAttribute('aria-current');
                });
            };
        });

        // Mobile menu
        if (toggle) {
            toggle.addEventListener('click', event => {
                event.preventDefault();
                setMenuOpen(!nav.classList.contains('open'));
            });
        }

        document.addEventListener('click', event => {
            if (nav.classList.contains('open') && !nav.contains(event.target)) setMenuOpen(false);
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && nav.classList.contains('open')) setMenuOpen(false);
        });

        listen(compactNavMedia, () => {
            if (!compactNavMedia.matches) setMenuOpen(false);
        });
    }


    /* ======================================================================
       5. MOTION
       ====================================================================== */

    // --- Scroll reveal: every direct child of a section fades and rises in ---

    function initReveal() {
        if (prefersReducedMotion || !('IntersectionObserver' in window)) return;

        const rootStyle = window.getComputedStyle(document.documentElement);
        const duration = parseFloat(rootStyle.getPropertyValue('--reveal-duration')) || 750;
        const stagger = parseFloat(rootStyle.getPropertyValue('--reveal-stagger')) || 60;

        function reveal(item, order) {
            const delay = Math.min(order, 3) * stagger;
            item.style.setProperty('--reveal-delay', delay + 'ms');
            item.classList.add('is-in');

            // Once the animation is over, hand control back to the element's own styles
            window.setTimeout(() => {
                item.classList.add('is-settled');
                item.style.removeProperty('--reveal-delay');
            }, duration + delay + 150);
        }

        const observer = new IntersectionObserver(entries => {
            entries
                .filter(entry => entry.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
                .forEach((entry, order) => {
                    observer.unobserve(entry.target);
                    reveal(entry.target, order);
                });
        }, { rootMargin: '0px 0px -4% 0px', threshold: 0 });

        const viewportHeight = window.innerHeight;
        const items = Array.from(document.querySelectorAll('section > *'));

        // Measure everything first, then change classes (no layout recalculation in between)
        const onScreen = items.map(item => {
            const rect = item.getBoundingClientRect();
            return rect.top < viewportHeight && rect.bottom > 0;
        });

        items.forEach((item, index) => {
            // Split headings animate word by word (see initHeadingReveal), the rest fade in
            if (!item.classList.contains('reveal-heading')) item.classList.add('reveal-item');

            if (onScreen[index]) {
                // Already on screen at load: show it without a fade-out first
                item.classList.add('is-in', 'is-settled');
            } else {
                observer.observe(item);
            }
        });
    }

    // --- Headline reveal: section titles rise word by word ---

    function initHeadingReveal() {
        if (prefersReducedMotion || !ENABLE_HEADING_REVEAL || !('IntersectionObserver' in window)) return;

        document.querySelectorAll('section > h2').forEach(heading => {
            const text = heading.textContent.trim();
            const words = text.split(/\s+/);

            heading.setAttribute('aria-label', text);
            heading.textContent = '';

            words.forEach((word, index) => {
                const outer = document.createElement('span');
                outer.className = 'word';
                outer.setAttribute('aria-hidden', 'true');

                const inner = document.createElement('span');
                inner.className = 'word-inner';
                inner.style.setProperty('--word-index', index);
                inner.textContent = word;

                outer.appendChild(inner);
                heading.appendChild(outer);
                if (index < words.length - 1) heading.appendChild(document.createTextNode(' '));
            });

            heading.classList.add('reveal-heading');
        });
    }

    // --- Layer effects: edge light on arrival, covered sheet recedes ---

    function initLayerEffects() {
        if (prefersReducedMotion || !layers.length) return;
        if (!ENABLE_EDGE_LIGHT && !ENABLE_RECEDING) return;

        function createFx(layer, className) {
            const element = document.createElement('div');
            element.className = 'layer-fx ' + className;
            element.setAttribute('aria-hidden', 'true');
            layer.prepend(element);
            return element;
        }

        const RECEDE_SCALE = 0.045;   // how much the covered sheet shrinks (4.5%)
        const RECEDE_DIM = 0.42;      // how dark it gets (42% black)
        const canRecede = ENABLE_RECEDING && !isLowPower;
        const SLOW_FRAME_MS = 45;     // slower than ~22 fps counts as a slow frame
        const SLOW_FRAMES_LIMIT = 10;  // this many while receding -> the effect switches itself off
        let slowFrames = 0;
        let lastFrameTime = 0;

        const fx = layers.map((layer, index) => ({
            layer,
            edge: ENABLE_EDGE_LIGHT && index > 0 ? createFx(layer, 'layer-edge') : null,
            dim: canRecede && index < layers.length - 1 ? createFx(layer, 'layer-dim') : null,
            cover: 0,
            scale: 1,
            originY: 0
        }));

        // The receding effect is the only costly one. If the device visibly struggles
        // while it runs, remove it for the rest of the visit.
        function stopReceding() {
            fx.forEach(item => {
                if (!item.dim) return;
                item.dim.remove();
                item.dim = null;
                item.cover = 0;
                setStyle(item.layer, 'transform', '');
                setStyle(item.layer, 'transformOrigin', '');
                setStyle(item.layer, 'willChange', '');
            });
        }

        // Positions come from the cached layer measurements, so this reads no layout
        onFrame(() => {
            const now = window.performance.now();
            const frameTime = now - lastFrameTime;
            lastFrameTime = now;

            const isReceding = fx.some(item => item.cover > 0 && item.cover < 1);
            if (isReceding && frameTime > SLOW_FRAME_MS && frameTime < 250) slowFrames++;

            const viewportHeight = window.innerHeight;
            const scrollY = window.scrollY;
            const stacking = document.documentElement.classList.contains('stack-on');

            // Where a layer is on screen (a sticky layer stops at its pin position)
            const screenTop = index => {
                const natural = layerTops[index] - scrollY;
                return stacking ? Math.max(natural, stackTops[index]) : natural;
            };

            const updates = fx.map((item, index) => {
                const update = {};

                // Edge light: rises while the sheet slides in, gone when it has settled
                if (item.edge) {
                    const position = clamp(screenTop(index) / viewportHeight, 0, 1);
                    update.edge = Math.sin(Math.PI * (1 - position)).toFixed(2);
                }

                // Receding: how far the next sheet has covered this one (0..1)
                if (item.dim && stacking) {
                    update.cover = clamp(1 - screenTop(index + 1) / viewportHeight, 0, 1);
                } else if (item.dim) {
                    update.cover = 0;
                }
                return update;
            });

            return () => {
                if (slowFrames >= SLOW_FRAMES_LIMIT) {
                    slowFrames = 0;
                    stopReceding();
                }

                fx.forEach((item, index) => {
                    const update = updates[index];

                    if (item.edge) setStyle(item.edge, 'opacity', update.edge);

                    if (item.dim && update.cover !== item.cover) {
                        const cover = update.cover;

                        // Scale around the middle of the viewport so nothing jumps;
                        // the origin is measured on the layer's untransformed position.
                        item.originY = clamp(viewportHeight / 2 - screenTop(index), 0, layerHeights[index]);
                        item.scale = 1 - RECEDE_SCALE * cover;
                        item.cover = cover;

                        setStyle(item.layer, 'transformOrigin', '50% ' + item.originY.toFixed(0) + 'px');
                        setStyle(item.layer, 'transform', cover ? 'scale(' + item.scale.toFixed(4) + ')' : '');
                        setStyle(item.layer, 'willChange', cover > 0 && cover < 1 ? 'transform' : '');
                        setStyle(item.dim, 'opacity', (RECEDE_DIM * cover).toFixed(3));
                    }
                });
            };
        });
    }

    // --- Hero: background parallax, pointer glow and portrait tilt ---

    function initHeroEffects() {
        const hero = document.querySelector('.hero');
        if (!hero || prefersReducedMotion) return;

        onFrame(() => {
            const shift = parallaxMedia.matches
                ? Math.min(Math.max(window.scrollY, 0) * 0.22, hero.offsetHeight * 0.09)
                : 0;

            return () => setVar(hero, '--hero-shift', shift.toFixed(0) + 'px');
        });

        if (!canHover) return;

        let pointerFrame = null;
        let pointer = null;

        function applyPointer() {
            pointerFrame = null;
            const rect = hero.getBoundingClientRect();
            const x = pointer.x - rect.left;
            const y = pointer.y - rect.top;

            hero.style.setProperty('--glow-x', x.toFixed(0) + 'px');
            hero.style.setProperty('--glow-y', y.toFixed(0) + 'px');
            hero.style.setProperty('--hero-tilt-y', ((x / rect.width - 0.5) * 10).toFixed(2) + 'deg');
            hero.style.setProperty('--hero-tilt-x', ((0.5 - y / rect.height) * 8).toFixed(2) + 'deg');
        }

        hero.addEventListener('pointermove', event => {
            pointer = { x: event.clientX, y: event.clientY };
            if (pointerFrame === null) pointerFrame = window.requestAnimationFrame(applyPointer);
        });

        hero.addEventListener('pointerleave', () => {
            hero.style.setProperty('--hero-tilt-x', '0deg');
            hero.style.setProperty('--hero-tilt-y', '0deg');
        });
    }

    // --- Projects timeline: line is drawn while scrolling, dots light up ---

    function initTimeline() {
        const section = document.querySelector('#projects');
        const cards = section ? Array.from(section.querySelectorAll(':scope > .project-card')) : [];
        if (!cards.length || prefersReducedMotion) return;

        section.classList.add('timeline-live');

        onFrame(() => {
            const viewportHeight = window.innerHeight;

            const states = cards.map(card => {
                const rect = card.getBoundingClientRect();
                return {
                    progress: clamp((viewportHeight * 0.6 - rect.top) / rect.height, 0, 1),
                    reached: rect.top < viewportHeight * 0.7
                };
            });

            return () => cards.forEach((card, index) => {
                setVar(card, '--line-progress', states[index].progress.toFixed(2));
                card.classList.toggle('is-reached', states[index].reached);
            });
        });
    }

    // --- Career cards: numbers count up when the card scrolls into view ---

    function initMetricCountUp() {
        if (prefersReducedMotion || !('IntersectionObserver' in window)) return;

        const cards = Array.from(document.querySelectorAll('.career-card[data-metric]'));
        if (!cards.length) return;

        const NUMBER = /\d+(?:\.\d+)?/g;
        const DURATION = 1400;
        const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

        function animate(card) {
            const finalText = card.dataset.metricFinal;
            const targets = (finalText.match(NUMBER) || []).map(Number);
            const startTime = performance.now();

            function step(now) {
                const progress = clamp((now - startTime) / DURATION, 0, 1);
                const eased = easeOutCubic(progress);
                let index = 0;

                card.dataset.metric = progress < 1
                    ? finalText.replace(NUMBER, () => Math.round(targets[index++] * eased))
                    : finalText;

                if (progress < 1) window.requestAnimationFrame(step);
            }
            window.requestAnimationFrame(step);
        }

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                animate(entry.target);
            });
        }, { threshold: 0.5 });

        cards.forEach(card => {
            card.dataset.metricFinal = card.dataset.metric;
            card.dataset.metric = card.dataset.metric.replace(NUMBER, '0');
            observer.observe(card);
        });
    }

    // --- Service and career cards: 3D tilt that follows the pointer ---

    function initCardTilt() {
        if (prefersReducedMotion || !canHover) return;

        document.querySelectorAll('.career-card, .service-item').forEach(card => {
            const maxTilt = card.classList.contains('service-item') ? 3.5 : 7;

            card.addEventListener('pointermove', event => {
                const rect = card.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;

                card.style.setProperty('--tilt-x', (-y * maxTilt).toFixed(2) + 'deg');
                card.style.setProperty('--tilt-y', (x * maxTilt).toFixed(2) + 'deg');
            });

            card.addEventListener('pointerleave', () => {
                card.style.setProperty('--tilt-x', '0deg');
                card.style.setProperty('--tilt-y', '0deg');
            });
        });
    }


    /* ======================================================================
       6. IMAGE PROTECTION
       Wraps images with a transparent overlay and blocks context menu / drag.
       ====================================================================== */

    function initImageProtection() {
        document.querySelectorAll('img').forEach(img => {
            if (img.closest('.protect-img-wrapper')) return;

            img.setAttribute('draggable', 'false');
            img.style.userSelect = 'none';

            const wrapper = document.createElement('span');
            wrapper.className = 'protect-img-wrapper';
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);

            const overlay = document.createElement('span');
            overlay.className = 'protect-overlay';
            wrapper.appendChild(overlay);

            overlay.addEventListener('contextmenu', event => event.preventDefault());
            overlay.addEventListener('mousedown', event => event.preventDefault());
            img.addEventListener('dragstart', event => event.preventDefault());
        });

        // Fallback: block the context menu anywhere on a protected image
        document.addEventListener('contextmenu', event => {
            if (event.target.closest && event.target.closest('.protect-img-wrapper')) {
                event.preventDefault();
            }
        }, true);
    }


    /* ======================================================================
       7. EMAIL PROMPT
       A small bubble next to the floating email button, shown periodically.
       ====================================================================== */

    function initEmailPrompt() {
        const FIRST_DELAY_MS = 10 * 1000;
        const INTERVAL_MS = 120 * 1000;
        const VISIBLE_MS = 12 * 1000;

        function messageHtml(language) {
            if (language === 'sk') {
                return 'Máte otázky alebo podnety? <a href="mailto:' + EMAIL + '">Neváhajte ma kontaktovať</a>.';
            }
            return 'Any questions or insights to share? <a href="mailto:' + EMAIL + '">Feel free to reach out</a>.';
        }

        function hidePopup(popup) {
            popup.classList.remove('visible');
            window.clearTimeout(popup.dismissTimeout);
        }

        function getPopup() {
            let popup = document.querySelector('.email-popup');
            if (popup) return popup;

            popup = document.createElement('div');
            popup.className = 'email-popup';
            popup.setAttribute('role', 'dialog');
            popup.setAttribute('aria-live', 'polite');
            popup.setAttribute('aria-label', 'Email prompt');

            const closeButton = document.createElement('button');
            closeButton.className = 'email-popup-close';
            closeButton.type = 'button';
            closeButton.setAttribute('aria-label', 'Close email prompt');
            closeButton.textContent = '×';
            closeButton.addEventListener('click', () => hidePopup(popup));

            const text = document.createElement('span');
            text.className = 'email-popup-text';

            popup.appendChild(closeButton);
            popup.appendChild(text);
            document.body.appendChild(popup);
            return popup;
        }

        function showPopup() {
            const popup = getPopup();
            popup.querySelector('.email-popup-text').innerHTML = messageHtml(getCurrentLanguage());
            popup.classList.add('visible');

            window.clearTimeout(popup.dismissTimeout);
            popup.dismissTimeout = window.setTimeout(() => hidePopup(popup), VISIBLE_MS);
        }

        window.setTimeout(() => {
            showPopup();
            window.setInterval(showPopup, INTERVAL_MS);
        }, FIRST_DELAY_MS);
    }


    /* ======================================================================
       8. START-UP
       ====================================================================== */

    // Redirect as early as possible, before anything is set up
    initPageFade();
    initLanguageRedirect();

    onReady(() => {
        initLanguageSelector();
        initLayers();          // must run before navigation and motion
        initNavigation();
        initHeadingReveal();   // before initReveal, which skips split headings
        initReveal();
        initLayerEffects();
        initHeroEffects();
        initTimeline();
        initMetricCountUp();
        initCardTilt();
        initImageProtection();
        initEmailPrompt();

        window.addEventListener('scroll', requestFrame, { passive: true });
        window.addEventListener('resize', requestFrame);
    });
})();
