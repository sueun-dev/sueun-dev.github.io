document.addEventListener('DOMContentLoaded', () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const getNavOffset = () => {
        const navbar = document.querySelector('.navbar');
        const navbarHeight = navbar instanceof HTMLElement ? navbar.offsetHeight : 0;
        return navbarHeight + 16;
    };

    const scrollToElement = (element, behavior) => {
        if (!(element instanceof HTMLElement)) return;
        const top = element.getBoundingClientRect().top + window.scrollY - getNavOffset();
        window.scrollTo({ top: Math.max(0, top), behavior });
    };

    const getScrollTarget = (target) => {
        if (!(target instanceof HTMLElement)) return null;
        if (target.matches('section')) return target.querySelector('.section-title') || target;
        return target;
    };

    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    const setNavOpen = (open) => {
        if (!hamburger || !navMenu) return;
        hamburger.classList.toggle('active', open);
        navMenu.classList.toggle('active', open);
        document.body.classList.toggle('nav-open', open);
        hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
        hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            setNavOpen(!navMenu.classList.contains('active'));
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') setNavOpen(false);
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) setNavOpen(false);
        });
    }

    // Smooth Scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const hash = anchor.getAttribute('href');
            if (!hash || hash === '#') return;

            const target = document.querySelector(hash);
            if (!target) return;

            e.preventDefault();
            setNavOpen(false);

            const isSkipLink = anchor.classList.contains('skip-link');
            const scrollTarget = getScrollTarget(target) || target;
            scrollToElement(scrollTarget, prefersReducedMotion || isSkipLink ? 'auto' : 'smooth');

            if (!isSkipLink) history.pushState(null, '', hash);
            if (!isSkipLink) {
                document.querySelectorAll('.nav-menu a[href^="#"]').forEach((link) => {
                    link.classList.toggle('active', link.getAttribute('href') === hash);
                });
            }

            if (scrollTarget instanceof HTMLElement) {
                if (!scrollTarget.hasAttribute('tabindex')) scrollTarget.setAttribute('tabindex', '-1');
                scrollTarget.focus({ preventScroll: true });
            }
        });
    });

    // Active section highlighting
    const navLinks = Array.from(document.querySelectorAll('.nav-menu a[href^="#"]'));
    const sectionIds = new Set(navLinks.map((link) => link.getAttribute('href')));
    const sections = Array.from(document.querySelectorAll('main section[id]')).filter((section) =>
        sectionIds.has(`#${section.id}`)
    );

    const setActiveLink = (hash) => {
        navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === hash);
        });
    };

    if (sections.length && navLinks.length) {
        let activeHash = null;
        let rafPending = false;

        const updateActiveByScroll = () => {
            const scrollY = window.scrollY || window.pageYOffset || 0;
            const anchorLine = scrollY + getNavOffset();

            let activeSection = sections[0];
            for (const section of sections) {
                const top = section.offsetTop;
                if (top <= anchorLine) activeSection = section;
            }

            const nextHash = `#${activeSection.id}`;
            if (nextHash === activeHash) return;
            activeHash = nextHash;
            setActiveLink(activeHash);
        };

        const onScroll = () => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                updateActiveByScroll();
                rafPending = false;
            });
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', updateActiveByScroll);
        window.addEventListener('popstate', updateActiveByScroll);
        window.addEventListener('load', updateActiveByScroll, { once: true });

        updateActiveByScroll();
    }

    // Ensure direct URL hashes land nicely below fixed nav
    window.addEventListener(
        'load',
        () => {
            if (!location.hash) return;
            const target = document.querySelector(location.hash);
            if (!target) return;
            const scrollTarget = getScrollTarget(target) || target;
            scrollToElement(scrollTarget, 'auto');
        },
        { once: true }
    );

    // Particle Background Effect
    if (!prefersReducedMotion) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        document.body.appendChild(canvas);

        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '-2';
        canvas.style.pointerEvents = 'none';

        const getCssVar = (name, fallback) => {
            const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return value || fallback;
        };

        const particleRgb = '34, 231, 255';
        const baseCount = window.innerWidth < 768 ? 24 : 50;
        const particleCount = Math.min(baseCount, 70);
        const linkDistance = 150;
        const linkDistanceSq = linkDistance * linkDistance;
        const cellSize = linkDistance;

        let viewWidth = window.innerWidth;
        let viewHeight = window.innerHeight;
        let rafId = null;
        let particles = [];

        function resize() {
            viewWidth = window.innerWidth;
            viewHeight = window.innerHeight;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(viewWidth * dpr);
            canvas.height = Math.floor(viewHeight * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        window.addEventListener('resize', resize);
        resize();

        const particleColor = getCssVar('--accent-cyan', `rgb(${particleRgb})`);
        const grid = new Map();
        const getCellKey = (x, y) => `${x},${y}`;

        class Particle {
            constructor() {
                this.x = Math.random() * viewWidth;
                this.y = Math.random() * viewHeight;
                this.vx = (Math.random() - 0.5) * 0.45;
                this.vy = (Math.random() - 0.5) * 0.45;
                this.size = 1 + Math.random() * 1.6;
                this.cellX = 0;
                this.cellY = 0;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0 || this.x > viewWidth) this.vx *= -1;
                if (this.y < 0 || this.y > viewHeight) this.vy *= -1;
            }

            draw() {
                ctx.fillStyle = particleColor;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        particles = Array.from({ length: particleCount }, () => new Particle());

        function animate() {
            ctx.clearRect(0, 0, viewWidth, viewHeight);
            grid.clear();

            particles.forEach((p, index) => {
                p.update();
                p.draw();

                const cellX = Math.floor(p.x / cellSize);
                const cellY = Math.floor(p.y / cellSize);
                p.cellX = cellX;
                p.cellY = cellY;

                const key = getCellKey(cellX, cellY);
                const bucket = grid.get(key);
                if (bucket) {
                    bucket.push(index);
                } else {
                    grid.set(key, [index]);
                }
            });

            // Spatial hashing to avoid O(n^2) pair checks.
            particles.forEach((p, index) => {
                for (let cx = p.cellX - 1; cx <= p.cellX + 1; cx++) {
                    for (let cy = p.cellY - 1; cy <= p.cellY + 1; cy++) {
                        const bucket = grid.get(getCellKey(cx, cy));
                        if (!bucket) continue;

                        for (const j of bucket) {
                            if (j <= index) continue;
                            const p2 = particles[j];
                            const dx = p.x - p2.x;
                            const dy = p.y - p2.y;
                            const distanceSq = dx * dx + dy * dy;

                            if (distanceSq < linkDistanceSq) {
                                const alpha = 0.12 * (1 - distanceSq / linkDistanceSq);
                                ctx.strokeStyle = `rgba(${particleRgb}, ${alpha})`;
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                ctx.moveTo(p.x, p.y);
                                ctx.lineTo(p2.x, p2.y);
                                ctx.stroke();
                            }
                        }
                    }
                }
            });

            rafId = requestAnimationFrame(animate);
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = null;
            } else if (!rafId) {
                rafId = requestAnimationFrame(animate);
            }
        });

        rafId = requestAnimationFrame(animate);
    }
});
