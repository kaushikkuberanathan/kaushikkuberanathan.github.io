# Kaushik Kuberanathan — Product Portfolio

Live site: <https://kaushikkuberanathan.github.io/>

This repository hosts my personal product portfolio on GitHub Pages. The site is intentionally lightweight: a single `index.html`, dedicated product-activity assets, and minimal vanilla JavaScript for tab and section navigation. No build step, no framework, no dependencies.

## Positioning

**Product Manager · Digital Commerce & Platforms — AI-Assisted Builder · Systems Thinker**

I build digital commerce, self-service, and platform products across B2B and B2C environments. The portfolio covers enterprise platform and commerce work, regulated CX, platform modernization, hands-on AI-assisted building, and shipped projects such as Dugout Lineup.

## Site structure

```
index.html                              # primary site markup and navigation
assets/product-activity.js              # résumé lead gate (the Building in Public activity tab it also installed is currently removed, see below)
assets/product-activity.css             # unused while Building in Public is removed (kept for reinstatement)
assets/confidential-gate.css            # Confidential Projects tab presentation
assets/confidential-gate.js             # Confidential Projects tab install, password unlock, report rendering
assets/confidential-projects.json       # AES-GCM encrypted report content (no plaintext committed)
scripts/encrypt-confidential.js         # regenerates assets/confidential-projects.json from local plaintext
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

The site is organized into tabs, in this order (Confidential Projects is inserted dynamically at runtime, right after Enterprise Impact — see below):

- **Overview** — a short "About" intro, an "Explore the portfolio" nav grid linking into every other tab, and the "Operating principles" that describe how I approach the work.
- **Enterprise Impact** — an enterprise proof summary, the full role-level impact stories (commerce, regulated CX, modernization), and named recommendations from colleagues.
- **Confidential Projects** — a password-gated tab with detailed "problem → approach → outcome" reports on select initiatives whose specifics are proprietary (see below).
- **Metrics** — an evidence index ("Metrics & evidence" plus a "Commerce & self-service depth" section) linking quantified outcomes back to the source story behind each one; a handful of figures are redacted (see Confidential metrics below).
- **Experience** — role cards ("Roles & experience") with title, company, duration, and most significant accomplishments, plus a single link to the full career history on LinkedIn.
- **Learning** — education history and the certifications and skills behind the practice (agile, analysis, and AI-assisted product work).
- **Product Lab** — a builder signal (the coaching-to-product discovery-to-build story) and a Projects grid with Dugout Lineup, the AI Career Strategy Team custom GPT, Locado (household inventory platform, rebranding from HomeAtlas), and KidCoord (parent carpool-coordination platform, paused — kept in the grid with a muted/dashed treatment so its status still reads clearly).
- **Contact** — "Get in touch" (open-to + preferred next step: email for roles, LinkedIn for network), "Follow the work" (GitHub/Substack plus product/AI writing essays), "Next chapter" direction, and "Beyond the work" on community, service, and personal interests.

## Automated product activity (currently removed)

Product Lab previously had a **Building in Public** tab installed at runtime, showing a rolling view of shipped work combining Dugout Lineup delivery with this portfolio repo's own commit activity. It's removed for now — the presentation (metric tiles and trend chart, then later a stripped-down "north star" callout) never landed on something worth keeping alongside the rest of the site.

- The `[data-product-activity]` markup section that `installActivityTab()` (in `assets/product-activity.js`) looks for has been deleted from `index.html`, so the tab no longer installs — the function no-ops gracefully rather than erroring.
- `assets/product-activity.js` is still loaded for `installResumeGate()` (see Résumé download & lead capture below); the activity-tab functions in that file are just currently unused.
- `assets/product-activity.css` is unreferenced but kept in the repo.
- The underlying data pipeline is untouched: `kaushikkuberanathan/lineup_generator`'s `generate-product-activity.mjs` still runs on its own schedule and publishes to this repo's `activity-data` branch, so reinstating the tab later is a markup/link-tag change, not a data-pipeline rebuild.

## Résumé download & lead capture

The "View résumé" CTA opens `Kaushik Kuberanathan - Resume.pdf` view-only in a new tab (no forced download).

- First-time visitors are gated behind an email-address form (`installResumeGate` in `assets/product-activity.js`) before the résumé opens; the email is remembered in `localStorage` so returning visitors aren't asked again.
- On submit, the site fires a `no-cors` POST to a Google Apps Script Web App (URL configured via `data-lead-endpoint` on the résumé link in `index.html`) that logs the request to a Google Sheet and emails the visitor a copy of the live résumé PDF.
- `resume-lead-apps-script.gs` is the source for that Apps Script — it isn't deployed by this repo; it's pasted into a separate Google Apps Script project and deployed as a Web App from a Google account. See the setup comment at the top of the file.
- Because Apps Script Web Apps don't return CORS headers, the front end can't confirm the email actually sent — treat the Google Sheet as the source of truth for delivery.

## Confidential metrics

Most figures on the site are shown as literal, specific numbers. A small number of figures that are proprietary Cox Communications performance data are redacted instead of generalized: the digits are replaced with a masked placeholder (e.g. `██.██%`) plus a lock icon, with a tooltip explaining the figure is withheld (`.confidential-figure` in `index.html`). The real values are removed from the markup entirely, not just visually blurred, so they aren't recoverable via page source or copy/paste.

## Confidential Projects tab

The **Confidential Projects** tab holds detailed "problem → approach → outcome" write-ups for initiatives whose specifics are proprietary (employer data, unreleased figures, etc.). It's built for a static, no-backend GitHub Pages site, so treat the gate as a **deterrent for casual visitors, not real access control** — see Threat model below.

**How it works**

- `assets/confidential-projects.json` contains only an AES-GCM ciphertext (plus a random salt/IV), never plaintext. Anyone can `view-source` or download this file and see nothing readable.
- `assets/confidential-gate.js` installs the tab (inserted right after Enterprise Impact at runtime), and on password submit: derives an AES-256 key from the entered password via PBKDF2-SHA256 (200,000 iterations) using WebCrypto's `crypto.subtle`, then attempts to decrypt the ciphertext. A wrong password fails the AES-GCM authentication check and shows "Incorrect password" — nothing about the content is revealed either way.
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

## Updating the site

1. Edit `index.html` or the relevant file under `assets/`.
2. Keep image filenames consistent (`kaushik-headshot.jpg` at the repo root; project, employer, and education logos under `icons/`).
3. Validate JavaScript syntax, responsive behavior, navigation, and the live JSON before merging.
4. Commit through a feature branch and pull request into `main`.
5. Confirm the post-merge live smoke workflow succeeds, then hard-refresh in a private/incognito window to bypass edge cache.

## Notes

This portfolio is a public-facing homepage. See Confidential metrics above for how sensitive figures are handled.
