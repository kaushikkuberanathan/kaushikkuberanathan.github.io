# Kaushik Kuberanathan — Product Portfolio

Live site: <https://kaushikkuberanathan.github.io/>

This repository hosts my personal product portfolio on GitHub Pages. The site is intentionally lightweight: a single `index.html`, dedicated product-activity assets, and minimal vanilla JavaScript for tab and section navigation. No build step, no framework, no dependencies.

## Positioning

**Lead Product Manager, Digital Commerce & Platforms**

Open to senior product leadership (Lead / Group / Director) in Atlanta. The first screen leads with published proof — 5M+ MAU, +32% YoY eCommerce, 4× orders, $35M cloud modernization — plus Email, LinkedIn, and the résumé. The same numbers are the GitHub profile README’s “At a Glance” table.

## Site structure

```
index.html                              # primary site markup and navigation
assets/product-activity.js              # activity-tab installer (unused) and the unused résumé email gate
assets/product-activity.css             # unused while Building in Public is removed (kept for reinstatement)
assets/fonts/                           # self-hosted Inter (latin, OFL)
assets/confidential-gate.css            # Confidential Projects presentation
assets/confidential-gate.js             # password unlock and report rendering; the gate is a Contact section, not a nav tab
assets/confidential-projects.json       # AES-GCM encrypted report content (no plaintext committed)
scripts/encrypt-confidential.js         # regenerates assets/confidential-projects.json from local plaintext
scripts/live-smoke.py                   # desktop/mobile browser validation
scripts/a11y-check.mjs                  # axe-core check for every tab, the skip link, and the mobile tab row
.github/workflows/live-smoke.yml        # local PR smoke + deployed main smoke
.github/workflows/a11y.yml              # PR axe-core gate (fail on serious/critical)
kaushik-headshot.jpg                    # hero headshot
Kaushik Kuberanathan - Resume.pdf       # résumé served by the "View résumé" CTA
resume-lead-apps-script.gs              # unused Apps Script for the old résumé email gate (kept in the repo, not called)
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

The primary nav is five tabs. The name, level, and Email / LinkedIn / résumé actions stay visible on every tab. Old hashes still resolve: `#tab-metrics` opens Impact at the headline proof, `#tab-learning` opens Experience at education, and `#tab-confidential` opens the Contact gate.

- **Overview** — point of view (the AI operating principle, essay cards, and the 60%+ workflow), a short About, an explore grid, and operating principles.
- **Impact** (button id `tab-enterprise`) — headline proof (5M+ MAU, +32% YoY, 4×, ~96% containment, ~75% title turnaround, $35M), supporting stats, flagship stories structured as problem / decision / outcome / role, the remaining impact stories, and colleague recommendations.
- **Experience** — role cards, then education and certifications (formerly the Learning tab).
- **Lab** (button id `tab-builder`, still the Product Lab panel) — builder signal and the projects grid.
- **Contact** — Email, LinkedIn, and a direct résumé link; Follow the work; Next chapter; Beyond the work; and **Request a deeper brief**, the password-gated confidential reports (see below).

## Automated product activity (currently removed)

Product Lab previously had a **Building in Public** tab installed at runtime, showing a rolling view of shipped work combining Dugout Lineup delivery with this portfolio repo's own commit activity. It's removed for now — the presentation (metric tiles and trend chart, then later a stripped-down "north star" callout) never landed on something worth keeping alongside the rest of the site.

- The `[data-product-activity]` markup section that `installActivityTab()` (in `assets/product-activity.js`) looks for has been deleted from `index.html`, so the tab no longer installs — the function no-ops gracefully rather than erroring.
- `assets/product-activity.js` is still loaded. `installResumeGate()` is not called. The activity-tab functions are unused because the markup they look for is gone.
- `assets/product-activity.css` is unreferenced but kept in the repo.
- The underlying data pipeline is untouched: `kaushikkuberanathan/lineup_generator`'s `generate-product-activity.mjs` still runs on its own schedule and publishes to this repo's `activity-data` branch, so reinstating the tab later is a markup/link-tag change, not a data-pipeline rebuild.

## Résumé

The "View résumé" links open `Kaushik Kuberanathan - Resume.pdf` directly in a new tab. There is no email gate and no forced download.

- `installResumeGate()` remains in `assets/product-activity.js` and is not called.
- `resume-lead-apps-script.gs` remains in the repo and is not called. It is the old Apps Script that logged an email and sent a PDF copy. Optional “Email me a copy” on Contact is a `mailto:` link, not that script.

## Confidential metrics

Most figures on the site are shown as literal, specific numbers. A small number of figures that are proprietary Cox Communications performance data are redacted instead of generalized: the digits are replaced with a masked placeholder (e.g. `██.██%`) plus a lock icon, with a tooltip explaining the figure is withheld (`.confidential-figure` in `index.html`). The real values are removed from the markup entirely, not just visually blurred, so they aren't recoverable via page source or copy/paste.

## Confidential Projects tab

The **Confidential Projects** tab holds detailed "problem → approach → outcome" write-ups for initiatives whose specifics are proprietary (employer data, unreleased figures, etc.). It's built for a static, no-backend GitHub Pages site, so treat the gate as a **deterrent for casual visitors, not real access control** — see Threat model below.

**How it works**

- `assets/confidential-projects.json` contains only an AES-GCM ciphertext (plus a random salt/IV), never plaintext. Anyone can `view-source` or download this file and see nothing readable.
- `assets/confidential-gate.js` places the gate in the Contact panel (not in the primary nav) and, on password submit, derives an AES-256 key from the entered password via PBKDF2-SHA256 (200,000 iterations) using WebCrypto's `crypto.subtle`, then attempts to decrypt the ciphertext. A wrong password fails the AES-GCM authentication check and shows "Incorrect password" — nothing about the content is revealed either way. The cipher, iterations, and lockout are unchanged.
- After 3 failed attempts, the Unlock button locks out with a short, increasing countdown (client-side friction only, not real rate limiting).
- A successful unlock renders the reports into the DOM for that page load only; nothing is cached in `localStorage`/`sessionStorage`, so reloading the tab re-locks it.
- Visitors without the password can request access via the "Request access" `mailto:` link in the gate (there's no backend/form handler on this static site, so email is the access-request channel).

**Threat model (be honest with yourself about this)**

This protects against a casual visitor reading the page source or the network tab. It does **not** protect against someone who saves the ciphertext and brute-forces the password offline, or against sharing the password itself. Don't put anything here you'd be upset to see leak if a determined person got the password.

**Updating the content**

1. Create `scripts/confidential-content.local.json` (gitignored — never commit this) with the real report content, shaped like:
   ```json
   { "updated": "Month YYYY", "reports": [{ "title": "...", "tag": "...", "status": "...", "problem": "...", "approach": "...", "outcome": "..." }] }
   ```
2. Run `node scripts/encrypt-confidential.js "<password>"` — this reads the local plaintext file, encrypts it, and overwrites `assets/confidential-projects.json`.
3. Commit only `assets/confidential-projects.json`. The plaintext source file must never be committed — it's covered by `.gitignore`.
4. To rotate the password, just re-run the script with a new password (same content file or a new one).

## Deployment validation

The smoke workflow uses the same browser assertions in two modes:

1. Pull requests start a local static server and validate the proposed branch at desktop and 390px mobile widths.
2. Pushes to `main` wait for GitHub Pages propagation and validate the deployed site, activity JSON, favicon, navigation, responsive containment, release-note links, and browser console.

## Accessibility check

`.github/workflows/a11y.yml` runs axe-core (`scripts/a11y-check.mjs`) on a local static server for every primary tab. Each view is opened with the same URL hash the site already handles in `hydrateFromHash()` (the same mechanism `scripts/live-smoke.py` uses for `#tab-experience`):

| Surface | Hash | Panel |
| --- | --- | --- |
| Overview | `#tab-overview` | `panel-overview` |
| Impact | `#tab-enterprise` | `panel-enterprise` |
| Experience | `#tab-experience` | `panel-experience` |
| Product Lab | `#tab-builder` | `panel-builder` |
| Contact | `#tab-contact` | `panel-contact` |

The same run checks the skip link (it is present, the first Tab focuses it, and activating it moves focus to its target inside `main`) and runs axe on the tab row at a 390px-wide viewport, including that every tab is visible and keyboard-focusable on one row.

**Mode: fail on serious and critical.** Moderate and minor violations are printed in the job log and do not fail the check. `A11Y_WARN_ONLY=1` forces warn-only for axe impact (exit 0); the skip-link and mobile tab-row assertions still fail the run. CI leaves warn-only unset. This is a light static-site gate, not a full WCAG audit. Rules are not disabled to get a green run.

The gate's first green baseline needed three contrast tweaks in `index.html`: footer text and the gray pill were just under 4.5:1, and the paused Product Lab card's `opacity: 0.92` was washing its text out. Covering Impact also required `role="img"` on the redacted Cox figures: a nameless `span` cannot carry `aria-label`. The skip target (`#top`) is focusable so keyboard activation lands inside `main`, and it keeps `scroll-margin-top` so the sticky tab bar does not cover it. The hero, including its `h1`, stays visible on every tab. Moderate and minor findings still do not fail the job.

## Updating the site

1. Edit `index.html` or the relevant file under `assets/`.
2. Keep image filenames consistent (`kaushik-headshot.jpg` at the repo root; project, employer, and education logos under `icons/`).
3. Validate JavaScript syntax, responsive behavior, navigation, and the live JSON before merging.
4. Commit through a feature branch and pull request into `main`.
5. Confirm the post-merge live smoke workflow succeeds, then hard-refresh in a private/incognito window to bypass edge cache.

## Notes

This portfolio is a public-facing homepage. See Confidential metrics above for how sensitive figures are handled.
