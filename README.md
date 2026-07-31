# Kaushik Kuberanathan — Product Portfolio

Live site: <https://kaushikkuberanathan.github.io/>

This repository hosts my personal product portfolio on GitHub Pages. The site is intentionally lightweight: a single `index.html`, dedicated product-activity assets, and minimal vanilla JavaScript for tab and section navigation. No build step, no framework, no dependencies.

## Positioning

**Product Manager · Digital Commerce & Platforms — AI-Assisted Builder · Systems Thinker**

I build digital commerce, self-service, and platform products across B2B and B2C environments. The portfolio covers enterprise platform and commerce work, regulated CX, platform modernization, hands-on AI-assisted building, and shipped projects such as Dugout Lineup.

## Site structure

```
index.html                         # primary site markup and navigation
assets/product-activity.css        # Building in Public presentation
assets/product-activity.js         # activity tab installation and JSON rendering
scripts/live-smoke.py              # desktop/mobile browser validation
.github/workflows/live-smoke.yml   # local PR smoke + deployed main smoke
kaushik-headshot.jpg               # hero headshot
dugout-lineup-logo.png             # Dugout Lineup project card logo
anna-university-logo.png           # Anna University education card logo
README.md
```

Optional image slots referenced in `index.html` (add the file to the repo root to activate; the site degrades gracefully if absent):

```
dugout-screenshot.png      # Dugout Lineup app screenshot (self-hides if missing)
coaching-photo.jpg         # optional coaching photo (commented out by default)
```

## Main sections

The site is organized into six tabs:

- **Overview** — headline positioning, career-at-a-glance, operating principles, and a "Who I am" section (community, service, and personal interests).
- **Enterprise Impact** — an enterprise proof summary, the full role-level impact stories (commerce, regulated CX, modernization), and named recommendations from colleagues.
- **Builder Projects** — a builder signal, the coaching-to-product discovery story, Dugout Lineup, the AI Career Strategy Team custom GPT, and product/AI writing.
- **Building in Public** — a dedicated responsive view of Dugout Lineup commit activity, monthly trends, production release notes, and the detailed six-month table.
- **Metrics** — a public-safe evidence index linking quantified outcomes back to the source story behind each one.
- **Experience** — role cards with title, company, duration, and most significant accomplishments, plus a single link to the full career history on LinkedIn.

## Automated product activity

The **Building in Public** tab displays a rolling six-month view of Dugout Lineup delivery.

- `assets/product-activity.css` contains the dedicated desktop and mobile presentation.
- `assets/product-activity.js` installs the tab before the core navigation initializes, moves the dashboard into its own panel, and loads the public activity JSON.
- The JSON is generated in `kaushikkuberanathan/lineup_generator` and published to its `activity-data` branch.
- Delivery volume is commit-driven: each eligible non-merge commit is counted once and classified as either a product improvement or a quality improvement.
- Product and quality counts reconcile to the committed-improvements total for every month.
- Production releases and the latest links remain release-note driven, using user-facing promotion PRs rather than story PRs.

The dashboard intentionally emphasizes sustained product-building effort and production evidence rather than PR volume.

## Deployment validation

The smoke workflow uses the same browser assertions in two modes:

1. Pull requests start a local static server and validate the proposed branch at desktop and 390px mobile widths.
2. Pushes to `main` wait for GitHub Pages propagation and validate the deployed site, activity JSON, favicon, navigation, responsive containment, release-note links, and browser console.

## Updating the site

1. Edit `index.html` or the relevant file under `assets/`.
2. Keep image filenames consistent (`kaushik-headshot.jpg`, `dugout-lineup-logo.png`, `anna-university-logo.png`).
3. Validate JavaScript syntax, responsive behavior, navigation, and the live JSON before merging.
4. Commit through a feature branch and pull request into `main`.
5. Confirm the post-merge live smoke workflow succeeds, then hard-refresh in a private/incognito window to bypass edge cache.

## Notes

This portfolio is a public-facing homepage. Confidential operating metrics are intentionally generalized (ranges or qualitative scale) for public sharing; exact figures are reserved for direct conversations.
