#!/usr/bin/env node
/**
 * Light accessibility check for the static portfolio.
 *
 * Loads Overview, Product Lab, and Contact the same way the site does:
 * a URL hash (`#tab-overview`, `#tab-builder`, `#tab-contact`) that
 * `hydrateFromHash()` in index.html applies on load. Inactive tab panels
 * stay `display: none`, so axe-core only sees the active view plus the
 * shared chrome (tab list, footer; hero on Overview).
 *
 * Mode: fail on serious and critical. Moderate and minor are printed and
 * do not fail the process. Set A11Y_WARN_ONLY=1 to force exit 0.
 *
 * Env:
 *   PORTFOLIO_SITE_URL   default http://127.0.0.1:8000/
 *   A11Y_FAIL_IMPACTS    default serious,critical
 *   A11Y_WARN_ONLY       1 = never fail on violations
 *   A11Y_REPORT_PATH     default ./a11y-report.json
 *   CHROME_PATH          optional browser executable (puppeteer-core)
 */

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

const SITE_URL = (process.env.PORTFOLIO_SITE_URL || 'http://127.0.0.1:8000/').replace(/\/?$/, '/');
const REPORT_PATH = process.env.A11Y_REPORT_PATH || 'a11y-report.json';
const WARN_ONLY = process.env.A11Y_WARN_ONLY === '1';
const FAIL_IMPACTS = new Set(
  (process.env.A11Y_FAIL_IMPACTS || 'serious,critical')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

// Button ids, matching scripts/live-smoke.py (`#tab-experience`).
// Product Lab's control is `tab-builder` (data-tab="builder"), not a
// "product-lab" slug.
const SURFACES = [
  { name: 'Overview', hash: '#tab-overview', panelId: 'panel-overview', tabId: 'tab-overview' },
  { name: 'Product Lab', hash: '#tab-builder', panelId: 'panel-builder', tabId: 'tab-builder' },
  { name: 'Contact', hash: '#tab-contact', panelId: 'panel-contact', tabId: 'tab-contact' },
];

const VIEWPORT = { width: 1280, height: 900 };

function loadRunner() {
  try {
    return { puppeteer: require('puppeteer'), bundled: true };
  } catch {
    return { puppeteer: require('puppeteer-core'), bundled: false };
  }
}

function chromeExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ];
  for (const command of candidates) {
    const found = spawnSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
    const path = (found.stdout || '').trim();
    if (found.status === 0 && path) return path;
  }
  return null;
}

function summarizeViolation(violation) {
  return {
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodeCount: violation.nodes.length,
    nodes: violation.nodes.slice(0, 8).map((node) => ({
      impact: node.impact || violation.impact,
      target: node.target,
      html: String(node.html || '').slice(0, 240),
      failureSummary: node.failureSummary || '',
    })),
  };
}

function countsFor(violations) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const violation of violations) {
    const impact = violation.impact || 'minor';
    if (impact in counts) counts[impact] += 1;
  }
  return counts;
}

function printSurface(surfaceResult) {
  const { counts } = surfaceResult;
  console.log(
    `\n${surfaceResult.name} ${surfaceResult.url}\n` +
      `  critical=${counts.critical} serious=${counts.serious} moderate=${counts.moderate} minor=${counts.minor}`,
  );
  for (const violation of surfaceResult.violations) {
    const blocking = !WARN_ONLY && FAIL_IMPACTS.has(violation.impact);
    const label = blocking ? 'FAIL' : 'WARN';
    console.log(`  ${label} [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodeCount})`);
    console.log(`        ${violation.helpUrl}`);
    for (const node of violation.nodes.slice(0, 3)) {
      const target = Array.isArray(node.target) ? node.target.join(' ') : String(node.target);
      console.log(`        - ${target}`);
      if (node.failureSummary) {
        const firstLine = node.failureSummary.split('\n').find((line) => line.trim()) || '';
        console.log(`          ${firstLine.trim()}`);
      }
    }
  }
}

async function scanSurface(page, axeSource, surface) {
  const url = `${SITE_URL}?a11y=${Date.now()}${surface.hash}`;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    (panelId, tabId) => {
      const panel = document.getElementById(panelId);
      const tab = document.getElementById(tabId);
      if (!panel || !tab) return false;
      const panelActive = panel.classList.contains('active');
      const tabSelected = tab.getAttribute('aria-selected') === 'true';
      return panelActive && tabSelected;
    },
    { timeout: 15000 },
    surface.panelId,
    surface.tabId,
  );

  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    if (!window.axe) throw new Error('axe-core did not attach to window');
    const outcome = await window.axe.run(document, { resultTypes: ['violations'] });
    return outcome.violations;
  });

  const summarized = violations.map(summarizeViolation);
  return {
    name: surface.name,
    hash: surface.hash,
    url,
    counts: countsFor(summarized),
    violations: summarized,
  };
}

async function main() {
  const { puppeteer, bundled } = loadRunner();
  const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  if (!bundled) {
    const executablePath = chromeExecutable();
    if (!executablePath) {
      throw new Error('Chrome/Chromium not found. Install the puppeteer package or set CHROME_PATH.');
    }
    launchOptions.executablePath = executablePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  const surfaces = [];
  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    for (const surface of SURFACES) {
      surfaces.push(await scanSurface(page, axeSource, surface));
    }
  } finally {
    await browser.close();
  }

  const blocking = [];
  let warned = 0;
  for (const surface of surfaces) {
    printSurface(surface);
    for (const violation of surface.violations) {
      if (!WARN_ONLY && FAIL_IMPACTS.has(violation.impact)) {
        blocking.push({ surface: surface.name, id: violation.id, impact: violation.impact });
      } else {
        warned += 1;
      }
    }
  }

  const mode = WARN_ONLY
    ? 'warn-only (A11Y_WARN_ONLY=1)'
    : `fail on ${[...FAIL_IMPACTS].join(', ') || 'none'}`;

  const report = {
    tool: 'axe-core',
    mode,
    url: SITE_URL,
    viewport: VIEWPORT,
    surfaces,
    blocking,
    warned,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\nA11Y RESULT: mode=${mode} blocking=${blocking.length} warned=${warned}`);
  console.log(`Report: ${REPORT_PATH}`);

  if (blocking.length) {
    console.error(`A11Y FAILED: ${blocking.length} serious/critical violation group(s).`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`A11Y CHECK ERROR: ${error && error.stack ? error.stack : error}`);
  process.exitCode = 2;
});
