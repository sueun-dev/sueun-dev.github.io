import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

export const scriptSource = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');

/**
 * A minimal but representative DOM that mirrors the real index.html structure
 * the script depends on: navbar, hamburger, nav-menu with hash links, a
 * skip-link, and <main> sections that each carry a .section-title.
 */
const SECTION_IDS = ['home', 'about', 'projects', 'contact'];

function buildMarkup() {
  const navLinks = SECTION_IDS.map(
    (id) => `<li><a href="#${id}" class="nav-link">${id}</a></li>`
  ).join('');

  const sections = SECTION_IDS.map(
    (id) =>
      `<section id="${id}"><h2 class="section-title">${id}</h2><p>${id} body</p></section>`
  ).join('');

  return `<!DOCTYPE html><html><head></head><body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <nav class="navbar">
      <ul class="nav-menu" id="nav-menu">${navLinks}</ul>
      <button class="hamburger" type="button" aria-label="Open menu" aria-expanded="false"></button>
    </nav>
    <main id="main-content">${sections}</main>
  </body></html>`;
}

/**
 * Spin up a jsdom window with all browser I/O the script touches mocked so the
 * tests are deterministic and offline. Returns { window, document, mocks }.
 *
 * @param {object} opts
 * @param {boolean} opts.reducedMotion  value matchMedia('(prefers-reduced-motion)') reports
 * @param {number}  opts.innerWidth     window.innerWidth
 * @param {Record<string, number>} opts.sectionTops  offsetTop per section id (layout is faked)
 */
export function createDom(opts = {}) {
  const {
    reducedMotion = true, // default true so the particle/canvas block is skipped
    innerWidth = 1280,
    innerHeight = 800,
    sectionTops = {},
    navbarHeight = 64,
  } = opts;

  const dom = new JSDOM(buildMarkup(), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.test/',
  });

  const { window } = dom;
  const { document } = window;

  // --- mock matchMedia ---
  const mediaCalls = [];
  window.matchMedia = (query) => {
    mediaCalls.push(query);
    return {
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  };

  // --- mock viewport ---
  Object.defineProperty(window, 'innerWidth', { value: innerWidth, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, writable: true, configurable: true });

  // --- mock scrolling ---
  const scrollCalls = [];
  window.scrollY = 0;
  window.pageYOffset = 0;
  window.scrollTo = (arg) => {
    scrollCalls.push(arg);
    const top = typeof arg === 'object' && arg ? arg.top : arguments[1];
    if (typeof top === 'number') {
      window.scrollY = top;
      window.pageYOffset = top;
    }
  };

  // --- mock rAF (synchronous-ish, but we control flushing) ---
  const rafQueue = [];
  let rafId = 0;
  window.requestAnimationFrame = (cb) => {
    rafId += 1;
    rafQueue.push({ id: rafId, cb });
    return rafId;
  };
  window.cancelAnimationFrame = (id) => {
    const idx = rafQueue.findIndex((entry) => entry.id === id);
    if (idx !== -1) rafQueue.splice(idx, 1);
  };
  const flushRaf = () => {
    const pending = rafQueue.splice(0, rafQueue.length);
    for (const entry of pending) entry.cb(performance.now ? performance.now() : Date.now());
  };

  // --- stub a 2D canvas context (jsdom has no canvas backend) ---
  const ctxStub = {
    setTransform() {},
    clearRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
  };
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    return ctxStub;
  };
  // getComputedStyle().getPropertyValue is used to read --accent-cyan
  const origGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (el, pseudo) => {
    const style = origGetComputedStyle(el, pseudo);
    return {
      getPropertyValue: (name) => (name === '--accent-cyan' ? '#22e7ff' : style.getPropertyValue(name)),
    };
  };

  // --- fake layout: navbar height + per-section offsetTop ---
  const navbar = document.querySelector('.navbar');
  Object.defineProperty(navbar, 'offsetHeight', { value: navbarHeight, configurable: true });

  for (const [id, top] of Object.entries(sectionTops)) {
    const section = document.getElementById(id);
    if (section) {
      Object.defineProperty(section, 'offsetTop', { value: top, configurable: true });
    }
  }

  // getBoundingClientRect: default to a deterministic top derived from offsetTop
  const origGBCR = window.Element.prototype.getBoundingClientRect;
  window.Element.prototype.getBoundingClientRect = function gbcr() {
    const offsetTop = this.offsetTop || 0;
    return {
      top: offsetTop - (window.scrollY || 0),
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: offsetTop - (window.scrollY || 0),
      toJSON() {},
    };
  };

  // --- run the real script.js inside this window's global scope ---
  const runScript = () => {
    window.eval(scriptSource);
  };

  const fireDOMContentLoaded = () => {
    const evt = new window.Event('DOMContentLoaded', { bubbles: true, cancelable: false });
    document.dispatchEvent(evt);
  };

  const fireLoad = () => {
    const evt = new window.Event('load');
    window.dispatchEvent(evt);
  };

  return {
    dom,
    window,
    document,
    mocks: { mediaCalls, scrollCalls, rafQueue, flushRaf },
    runScript,
    fireDOMContentLoaded,
    fireLoad,
    origGBCR,
  };
}
