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
scripts/live-smoke.py              # deployed desktop/mobile browser validation
.github/workflows/live-smoke.yml   # automatic and manual live smoke workflow
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
- **Building in Public** — a dedicated responsive view of Dugout Lineup delivery activity, monthly trends, release notes, and the detailed six-month table.
- **Metrics** — a public-safe evidence index linking quantified outcomes back to the source story behind each one.
- **Experience** — role cards with title, company, duration, and most significant accomplishments, plus a single link to the full career history on LinkedIn.

## Automated product activity

The **Building in Public** tab displays a rolling six-month view of Dugout Lineup delivery.

- `assets/product-activity.css` contains the dedicated desktop and mobile presentation.
- `assets/product-activity.js` installs the tab before the core navigation initializes, moves the dashboard into its own panel, and loads the public activity JSON.
- The JSON is generated in `kaushikkuberanathan/lineup_generator` and published to its `activity-data` branch.
- Counts distinguish merged pull requests, product improvements, production releases, quality improvements, and non-merge development commits.
- The latest links come from summarized production release promotion PRs rather than individual story PRs.

The dashboard intentionally emphasizes product delivery and release evidence rather than raw contribution volume.

## Live smoke test

The **Live portfolio smoke** GitHub Actions workflow validates the deployed GitHub Pages site after relevant changes and can also be run manually.

It waits for the new deployment, verifies the site, JavaScript, CSS, and activity JSON endpoints, then opens the real portfolio in headless Chrome at desktop and 390px mobile widths. The test confirms:

- The Building in Public tab activates from its URL hash.
- The dashboard is no longer inside Overview.
- Live data replaces the fallback state.
- Four metric cards, six monthly rows, and at least three release-note links render.
- Story PRs do not appear in the release-note list.
- The page has no document-level horizontal overflow.
- The mobile table scrolls inside its own container.
- The browser console contains no severe errors.

## Updating the site

1. Edit `index.html` or the relevant file under `assets/`.
2. Keep image filenames consistent (`kaushik-headshot.jpg`, `dugout-lineup-logo.png`, `anna-university-logo.png`).
3. Validate JavaScript syntax, responsive behavior, navigation, and the live JSON fallback before merging.
4. Commit to the `main` branch.
5. GitHub Pages republishes automatically after a short delay, and the live smoke workflow validates the deployed result.
6. Hard-refresh in a private/incognito window to bypass edge cache when reviewing manually.

## Notes

This portfolio is a public-facing homepage. Confidential operating metrics are intentionally generalized (ranges or qualitative scale) for public sharing; exact figures are reserved for direct conversations.
