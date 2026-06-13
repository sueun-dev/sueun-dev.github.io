import test from 'node:test';
import assert from 'node:assert/strict';

import { createDom } from './dom-helpers.mjs';

/** Boot a DOM, run the real script.js, and fire DOMContentLoaded. */
function boot(opts) {
  const ctx = createDom(opts);
  ctx.runScript();
  ctx.fireDOMContentLoaded();
  return ctx;
}

// --------------------------------------------------------------------------
// Mobile nav toggle (setNavOpen via hamburger click)
// --------------------------------------------------------------------------

test('hamburger click opens the menu and sets aria attributes', () => {
  const { document } = boot();
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  hamburger.dispatchEvent(new document.defaultView.Event('click', { bubbles: true }));

  assert.equal(navMenu.classList.contains('active'), true);
  assert.equal(hamburger.classList.contains('active'), true);
  assert.equal(document.body.classList.contains('nav-open'), true);
  assert.equal(hamburger.getAttribute('aria-expanded'), 'true');
  assert.equal(hamburger.getAttribute('aria-label'), 'Close menu');
});

test('hamburger click toggles the menu closed again', () => {
  const { document } = boot();
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  const Event = document.defaultView.Event;

  hamburger.dispatchEvent(new Event('click', { bubbles: true }));
  assert.equal(navMenu.classList.contains('active'), true);

  hamburger.dispatchEvent(new Event('click', { bubbles: true }));
  assert.equal(navMenu.classList.contains('active'), false);
  assert.equal(hamburger.getAttribute('aria-expanded'), 'false');
  assert.equal(hamburger.getAttribute('aria-label'), 'Open menu');
});

test('Escape key closes an open menu', () => {
  const { document, window } = boot();
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  hamburger.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(navMenu.classList.contains('active'), true);

  const esc = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
  document.dispatchEvent(esc);
  assert.equal(navMenu.classList.contains('active'), false);
});

test('a non-Escape keydown does not close the menu', () => {
  const { document, window } = boot();
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  hamburger.dispatchEvent(new window.Event('click', { bubbles: true }));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  assert.equal(navMenu.classList.contains('active'), true);
});

test('resize above 1024px closes the menu; at/below does not', () => {
  const { document, window } = boot({ innerWidth: 1280 });
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  // open, then a narrow resize must NOT auto-close
  hamburger.dispatchEvent(new window.Event('click', { bubbles: true }));
  window.innerWidth = 800;
  window.dispatchEvent(new window.Event('resize'));
  assert.equal(navMenu.classList.contains('active'), true, 'narrow resize keeps menu open');

  // a wide resize closes it
  window.innerWidth = 1200;
  window.dispatchEvent(new window.Event('resize'));
  assert.equal(navMenu.classList.contains('active'), false, 'wide resize closes menu');
});

// --------------------------------------------------------------------------
// Smooth scrolling on anchor click
// --------------------------------------------------------------------------

test('clicking a nav hash link prevents default, pushes history, and sets active', () => {
  const { document, window } = boot({ sectionTops: { home: 0, about: 500, projects: 1000, contact: 1500 } });

  let pushed = null;
  window.history.pushState = (state, title, url) => {
    pushed = url;
  };

  const aboutLink = document.querySelector('.nav-menu a[href="#about"]');
  const evt = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  aboutLink.dispatchEvent(evt);

  assert.equal(evt.defaultPrevented, true, 'click should be prevented');
  assert.equal(pushed, '#about', 'history.pushState called with the hash');
  assert.equal(aboutLink.classList.contains('active'), true, 'clicked link becomes active');

  // and the active class is exclusive
  const homeLink = document.querySelector('.nav-menu a[href="#home"]');
  assert.equal(homeLink.classList.contains('active'), false);
});

test('clicking a link scrolls to the section title (getScrollTarget)', () => {
  const { document, window, mocks } = boot({
    sectionTops: { home: 0, about: 500, projects: 1000, contact: 1500 },
  });

  // Give the section-title a deterministic offsetTop so scrollToElement has a target.
  const aboutTitle = document.querySelector('#about .section-title');
  Object.defineProperty(aboutTitle, 'offsetTop', { value: 520, configurable: true });

  const aboutLink = document.querySelector('.nav-menu a[href="#about"]');
  aboutLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

  assert.ok(mocks.scrollCalls.length >= 1, 'scrollTo was invoked');
  const last = mocks.scrollCalls[mocks.scrollCalls.length - 1];
  // navbarHeight(64)+16 = 80 offset; title top 520 -> 520-80 = 440
  assert.equal(last.top, 440);
});

test('skip-link click uses auto scroll and does NOT push history', () => {
  const { document, window } = boot({ sectionTops: { home: 0 } });

  // The skip-link points at #main-content; give it an offsetTop.
  const main = document.getElementById('main-content');
  Object.defineProperty(main, 'offsetTop', { value: 100, configurable: true });

  let pushed = false;
  window.history.pushState = () => {
    pushed = true;
  };

  const skip = document.querySelector('.skip-link');
  const evt = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  skip.dispatchEvent(evt);

  assert.equal(evt.defaultPrevented, true);
  assert.equal(pushed, false, 'skip-link must not push history');
});

test('clicking href="#" (no real target) is a no-op (no preventDefault)', () => {
  // A bare "#" anchor must be present BEFORE the script binds its handlers
  // (handlers are attached once at DOMContentLoaded).
  const ctx = createDom();
  const a = ctx.document.createElement('a');
  a.setAttribute('href', '#');
  a.className = 'nav-link';
  a.textContent = 'top';
  const li = ctx.document.createElement('li');
  li.appendChild(a);
  ctx.document.querySelector('.nav-menu').appendChild(li);

  ctx.runScript();
  ctx.fireDOMContentLoaded();

  const evt = new ctx.window.MouseEvent('click', { bubbles: true, cancelable: true });
  a.dispatchEvent(evt);
  assert.equal(evt.defaultPrevented, false, '"#" link should not be intercepted');
});

// --------------------------------------------------------------------------
// Scroll-spy (updateActiveByScroll): picks the last section whose offsetTop
// is at or above the anchor line (scrollY + navOffset).
// --------------------------------------------------------------------------

test('scroll-spy marks the first section active at the top of the page', () => {
  const { document } = boot({ sectionTops: { home: 0, about: 500, projects: 1000, contact: 1500 } });
  const homeLink = document.querySelector('.nav-menu a[href="#home"]');
  assert.equal(homeLink.classList.contains('active'), true);
});

test('scroll-spy activates the section the user has scrolled into', () => {
  const { document, window, mocks } = boot({
    sectionTops: { home: 0, about: 500, projects: 1000, contact: 1500 },
  });

  // navOffset = 64 + 16 = 80. Scroll so anchorLine (scrollY+80) passes "projects" (1000).
  window.scrollY = 950; // anchorLine = 1030 >= 1000(projects), < 1500(contact)
  window.dispatchEvent(new window.Event('scroll'));
  mocks.flushRaf();

  const projectsLink = document.querySelector('.nav-menu a[href="#projects"]');
  const aboutLink = document.querySelector('.nav-menu a[href="#about"]');
  assert.equal(projectsLink.classList.contains('active'), true, 'projects is active');
  assert.equal(aboutLink.classList.contains('active'), false, 'only one link active');
});

test('scroll-spy coalesces multiple scroll events into one rAF callback', () => {
  const { window, mocks } = boot({
    sectionTops: { home: 0, about: 500, projects: 1000, contact: 1500 },
  });

  const before = mocks.rafQueue.length;
  window.dispatchEvent(new window.Event('scroll'));
  window.dispatchEvent(new window.Event('scroll'));
  window.dispatchEvent(new window.Event('scroll'));
  // Three scrolls while a frame is pending should schedule only ONE rAF.
  assert.equal(mocks.rafQueue.length - before, 1);
});

// --------------------------------------------------------------------------
// Particle background gating by prefers-reduced-motion
// --------------------------------------------------------------------------

test('reduced-motion: no <canvas> is created', () => {
  const { document } = boot({ reducedMotion: true });
  assert.equal(document.querySelector('canvas'), null);
});

test('motion allowed: a fixed background canvas is created and styled', () => {
  const { document } = boot({ reducedMotion: false });
  const canvas = document.querySelector('canvas');
  assert.ok(canvas, 'canvas should be appended when motion is allowed');
  assert.equal(canvas.style.position, 'fixed');
  assert.equal(canvas.style.zIndex, '-2');
  assert.equal(canvas.style.pointerEvents, 'none');
});
