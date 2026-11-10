# Keylight website

Static files, no build step. Upload the contents of this folder as they are to any static host.
Nothing else in the repository is part of the site.

- `index.html`, `style.css`, `main.js`, `img/`, `video/`: the main page.
- `guide.html`, `guide.css`: the user guide. Its facts come from `docs/SITE-GUIDE-FACTS.md`; update both together.

Not part of the site (kept outside this folder on purpose):

- `site-mockups/paper.html` and `site-mockups/stage.html`: two alternative designs.
- `scripts/serve-site.mjs`: local preview.

Preview on this computer:

```bash
node scripts/serve-site.mjs
```

Then open http://localhost:4173 (the guide is at /guide.html, the mockups at /mockups/paper.html and /mockups/stage.html).

Deploying: `_headers` (security headers and cache times), `robots.txt` and `sitemap.xml` are read by Cloudflare Pages and similar hosts. The address `https://keylightpiano.app` is written into the canonical links, the share preview and the sitemap; change it in `index.html`, `guide.html`, `privacy.html`, `robots.txt` and `sitemap.xml` if the domain changes.

Before going live:

- The download buttons ask GitHub for the newest release and link to its files. Until a release with a disk image, an installer and an APK exists, they open the releases page.
- Every number on the page (76 songs, 94 lessons, 12 levels, fifteen sounds) comes from the app at the time of writing. Check them again at release.
- The screenshots in `img/` and the clips in `video/` were taken from the app on 2026-11-10 with `scripts/record.sh`.
