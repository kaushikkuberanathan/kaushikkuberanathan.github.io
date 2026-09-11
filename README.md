# Kaushik Kuberanathan — Product Portfolio

Live site: <https://kaushikkuberanathan.github.io/>

This repository hosts my personal product portfolio on GitHub Pages. The site is intentionally lightweight: a single `index.html`, dedicated product-activity assets, and minimal vanilla JavaScript for tab and section navigation. No build step, no framework, no dependencies.

## Positioning

**Product Manager · Digital Commerce & Platforms — AI-Assisted Builder · Systems Thinker**

I build digital commerce, self-service, and platform products across B2B and B2C environments. The portfolio covers enterprise platform and commerce work, regulated CX, platform modernization, hands-on AI-assisted building, and shipped projects such as Dugout Lineup.

## Site structure

```
index.html                              # primary site markup and navigation
assets/product-activity.css             # Building in Public presentation
assets/product-activity.js              # activity tab install, JSON rendering, résumé lead gate
scripts/live-smoke.py                   # desktop/mobile browser validation
.github/workflows/live-smoke.yml        # local PR smoke + deployed main smoke
kaushik-headshot.jpg                    # hero headshot
Kaushik Kuberanathan - Resume.pdf       # résumé served by the "View résumé" CTA
resume-lead-apps-script.gs              # Google Apps Script source for the résumé lead-capture backend (deployed separately, not built by this repo)
icons/                                  # project, employer, and education logos
  dugout-lineup-logo.png                  # Dugout Lineup project card logo
  anna-university-logo.png                # Anna University education card logo
  university-of-florida-logo.png          # University of Florida education card logo (unused, kept for future use)
  charter-communications-logo.png         # Charter Communications experience card logo
  cox-communications-logo.png             # Cox Communications experience card logo
  cox-automotive-logo.svg                 # Cox Automotive experience card logo
  equifax-logo.png                        # Equifax experience card logo
README.md
```

Optional image slots referenced in `index.html` (add the file to the repo root to activate; the site degrades gracefully if absent):

```
dugout-screenshot.png      # Dugout Lineup app screenshot (self-hides if missing)
coaching-photo.jpg         # optional coaching photo (commented out by default)
```

## Main sections

The site is organized into six tabs, in this order:

- **Overview** — headline positioning, career-at-a-glance, operating principles, and a "Who I am" section (community, service, and personal interests).
- **Enterprise Impact** — an enterprise proof summary, the full role-level impact stories (commerce, regulated CX, modernization), and named recommendations from colleagues.
- **Metrics** — an evidence index linking quantified outcomes back to the source story behind each one; a handful of figures are redacted (see Confidential metrics below).
- **Experience** — role cards with title, company, duration, and most significant accomplishments, plus a single link to the full career history on LinkedIn.
- **Builder Projects** — a builder signal, the coaching-to-product discovery story, Dugout Lineup, the AI Career Strategy Team custom GPT, and product/AI writing.
- **Building in Public** — a dedicated responsive view of Dugout Lineup commit activity, monthly trends, production release notes, and the detailed six-month table.

## Automated product activity

The **Building in Public** tab displays a rolling six-month view of Dugout Lineup delivery.

- `assets/product-activity.css` contains the dedicated desktop and mobile presentation.
- `assets/product-activity.js` installs the tab before the core navigation initializes, moves the dashboard into its own panel, and loads the public activity JSON.
- The JSON is generated in `kaushikkuberanathan/lineup_generator` (private) and published to the `activity-data` branch of **this** repo, so the sanitized metrics stay public even though the app source does not.
- Delivery volume is commit-driven: each eligible non-merge commit is counted once and classified as either a product improvement or a quality improvement.
- Product and quality counts reconcile to the committed-improvements total for every month.
- Production releases and the latest links remain release-note driven, using user-facing promotion PRs rather than story PRs.

The dashboard intentionally emphasizes sustained product-building effort and production evidence rather than PR volume.

## Résumé download & lead capture

The "View résumé" CTA opens `Kaushik Kuberanathan - Resume.pdf` view-only in a new tab (no forced download).

- First-time visitors are gated behind an email-address form (`installResumeGate` in `assets/product-activity.js`) before the résumé opens; the email is remembered in `localStorage` so returning visitors aren't asked again.
- On submit, the site fires a `no-cors` POST to a Google Apps Script Web App (URL configured via `data-lead-endpoint` on the résumé link in `index.html`) that logs the request to a Google Sheet and emails the visitor a copy of the live résumé PDF.
- `resume-lead-apps-script.gs` is the source for that Apps Script — it isn't deployed by this repo; it's pasted into a separate Google Apps Script project and deployed as a Web App from a Google account. See the setup comment at the top of the file.
- Because Apps Script Web Apps don't return CORS headers, the front end can't confirm the email actually sent — treat the Google Sheet as the source of truth for delivery.

## Confidential metrics

Most figures on the site are shown as literal, specific numbers. A small number of figures that are proprietary Cox Communications performance data are redacted instead of generalized: the digits are replaced with a masked placeholder (e.g. `██.██%`) plus a lock icon, with a tooltip explaining the figure is withheld (`.confidential-figure` in `index.html`). The real values are removed from the markup entirely, not just visually blurred, so they aren't recoverable via page source or copy/paste.

## Deployment validation

The smoke workflow uses the same browser assertions in two modes:

1. Pull requests start a local static server and validate the proposed branch at desktop and 390px mobile widths.
2. Pushes to `main` wait for GitHub Pages propagation and validate the deployed site, activity JSON, favicon, navigation, responsive containment, release-note links, and browser console.

## Updating the site

1. Edit `index.html` or the relevant file under `assets/`.
2. Keep image filenames consistent (`kaushik-headshot.jpg` at the repo root; project, employer, and education logos under `icons/`).
3. Validate JavaScript syntax, responsive behavior, navigation, and the live JSON before merging.
4. Commit through a feature branch and pull request into `main`.
5. Confirm the post-merge live smoke workflow succeeds, then hard-refresh in a private/incognito window to bypass edge cache.

## Notes

This portfolio is a public-facing homepage. See Confidential metrics above for how sensitive figures are handled.
