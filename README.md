# Sueun Cho - Portfolio Website

🌐 **Live Site**: [https://sueun-dev.github.io](https://sueun-dev.github.io)

## Overview

Personal portfolio website for Sueun Cho, a Blockchain Systems Engineer. It is a single static page (`index.html`) built with plain HTML, CSS, and JavaScript — no runtime framework — and deployed via GitHub Pages. A small Node-based dev toolchain is used to purge unused CSS and to measure CSS coverage.

## Features

### 🎨 Design & UX
- **Responsive design**: layout adapts to desktop, tablet, and mobile
- **Dark theme**: dark color scheme with gradient accents
- **Animations**: floating hero animation and fade-in/scroll effects, with `prefers-reduced-motion` respected
- **Interactive navigation**: hamburger menu, smooth scrolling, and scroll-spy that highlights the active section

### 🛠️ Technical
- **No runtime framework**: the shipped site is pure HTML/CSS/JS
- **SEO basics**: meta description/keywords, canonical link, `robots.txt`, Open Graph and Twitter Card tags
- **CSS build step**: [PurgeCSS](https://purgecss.com/) strips unused rules from `style.css` into `dist/style.css` (the file the page actually loads)
- **CSS coverage tool**: a Puppeteer script reports how much CSS is actually used
- **Accessible**: semantic HTML, ARIA attributes on the menu, skip-link, and keyboard-friendly navigation

### 📱 Sections
The page is a single scrolling layout with these sections:
- **Home** – introduction with the hero animation and resume link
- **About** – background and interests
- **Education**
- **Experience** – professional work history
- **Projects** – featured projects
- **Activities** – extracurricular and community involvement
- **Publications**
- **Awards**
- **Skills** – technical expertise by domain
- **Contact** – ways to connect

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: CSS Grid, Flexbox, CSS Variables, `clamp()` for fluid typography
- **Icons**: inline SVG sprite
- **Fonts**: Inter and JetBrains Mono (Google Fonts)
- **SEO**: meta tags, Open Graph, Twitter Cards, `robots.txt`, `sitemap.xml`
- **Tooling**: PurgeCSS, Puppeteer (`puppeteer-core`)
- **Hosting**: GitHub Pages

## Project Structure

```
sueun-dev.github.io/
├── index.html              # The site (all content, loads dist/style.css)
├── style.css               # Source stylesheet (input to PurgeCSS)
├── dist/
│   └── style.css           # Purged stylesheet served by the page
├── script.js               # Navigation, smooth scroll, scroll-spy, animations
├── purgecss.config.js      # PurgeCSS configuration
├── tools/
│   └── coverage.mjs        # Puppeteer-based CSS coverage report
├── assets/
│   └── sueun-cho-resume.pdf
├── robots.txt              # Crawler instructions
├── sitemap.xml             # Sitemap for search engines
├── google-search-setup.md  # Google Search Console / SEO notes
├── package.json            # npm scripts and dev dependencies
└── README.md
```

## Local Development

Clone the repository:

```bash
git clone https://github.com/sueun-dev/sueun-dev.github.io.git
cd sueun-dev.github.io
```

Serve the site locally (the page loads `dist/style.css`, which is committed, so no build is required to preview):

```bash
python3 -m http.server 8000
# or
npx serve
```

Then open http://localhost:8000.

### Build & tooling (optional)

Install dev dependencies first:

```bash
npm install
```

Regenerate the purged stylesheet (`dist/style.css`) after editing `style.css`:

```bash
npm run purgecss
```

Generate a CSS coverage report (requires Google Chrome; the script launches it via `puppeteer-core`). Serve the site on `http://localhost:8000/` first, then run:

```bash
npm run coverage
```

The coverage script reads `COVERAGE_URL`, `COVERAGE_OUTPUT`, and `CHROME_PATH` environment variables and writes JSON reports to a `coverage/` directory.

## SEO

- **Sitemap**: `sitemap.xml` lists the canonical homepage URL and is referenced from `robots.txt`
- **Robots.txt**: allows all search engines and points to the sitemap
- **Meta tags**: description, keywords, canonical link, Open Graph, and Twitter Card
- See `google-search-setup.md` for Search Console setup notes

## Browser Support

- Chrome, Firefox, Safari, Edge (latest)
- Mobile browsers (iOS Safari, Chrome Android)

## Contact

- **Email**: sueun.dev@gmail.com
- **Phone**: +1 240-413-4402
- **GitHub**: [@sueun-dev](https://github.com/sueun-dev)
- **Location**: Hyattsville, MD 20782

## License

© 2025 Sueun Cho. All rights reserved.

---

Built with ❤️ by Sueun Cho
