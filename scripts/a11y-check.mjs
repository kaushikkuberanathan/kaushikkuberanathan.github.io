#!/usr/bin/env node
/**
 * Light accessibility check for the static portfolio.
 *
 * Loads each primary tab the same way the site does: a URL hash
 * (`#tab-overview`, `#tab-enterprise`, `#tab-experience`, `#tab-builder`,
 * `#tab-contact`) that `hydrateFromHash()` in index.html applies on load.
 * Inactive tab panels stay `display: none`, so axe-core only sees the
 * active view plus the shared chrome (tab list, footer; hero on Overview).
 *
 * Also asserts the skip link (present, keyboard-focusable, target inside
 * main, focus lands on that target) and runs a ~390px pass over the tab row.
 *
 * Mode: fail on serious and critical. Moderate and minor are printed and
 * do not fail the process. Set A11Y_WARN_ONLY=1 to force exit 0 for axe
 * impact filtering. Skip-link and mobile tab-row assertions still fail
 * the process. Do not disable axe rules to get a green run.
 *
 * Env:
 *   PORTFOLIO_SITE_URL   default http://127.0.0.1:8000/
 *   A11Y_FAIL_IMPACTS    default serious,critical
 *   A11Y_WARN_ONLY       1 = do not fail on axe impact (structural checks still fail)
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
// "product-lab" slug. Impact's control is `tab-enterprise`.
const SURFACES = [
  { name: 'Overview', hash: '#tab-overview', panelId: 'panel-overview', tabId: 'tab-overview' },
  { name: 'Impact', hash: '#tab-enterprise', panelId: 'panel-enterprise', tabId: 'tab-enterprise' },
  { name: 'Experience', hash: '#tab-experience', panelId: 'panel-experience', tabId: 'tab-experience' },
  { name: 'Product Lab', hash: '#tab-builder', panelId: 'panel-builder', tabId: 'tab-builder' },
  { name: 'Contact', hash: '#tab-contact', panelId: 'panel-contact', tabId: 'tab-contact' },
];

const DESKTOP_VIEWPORT = { width: 1280, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const MOBILE_TAB_ROOT = '.tabs-shell';

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

async function runAxe(page, axeSource, rootSelector) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async (selector) => {
    if (!window.axe) throw new Error('axe-core did not attach to window');
    const root = selector ? document.querySelector(selector) : document;
    if (!root) throw new Error(`axe root not found: ${selector}`);
    const outcome = await window.axe.run(root, { resultTypes: ['violations'] });
    return outcome.violations;
  }, rootSelector || null);
  return violations.map(summarizeViolation);
}

async function waitForSurface(page, surface) {
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
}

async function scanSurface(page, axeSource, surface, axeRoot) {
  const url = `${SITE_URL}?a11y=${Date.now()}${surface.hash}`;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await waitForSurface(page, surface);
  const summarized = await runAxe(page, axeSource, axeRoot);
  return {
    name: surface.name,
    hash: surface.hash,
    url,
    axeRoot: axeRoot || null,
    counts: countsFor(summarized),
    violations: summarized,
  };
}

async function checkSkipLink(page) {
  const url = `${SITE_URL}?a11y=skip-${Date.now()}`;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('main', { timeout: 15000 });

  await page.evaluate(() => {
    const active = document.activeElement;
    if (active && typeof active.blur === 'function') active.blur();
  });
  await page.keyboard.press('Tab');

  const focused = await page.evaluate(() => {
    const link = document.querySelector('a.skip-link');
    const main = document.querySelector('main');
    const active = document.activeElement;
    const href = link ? (link.getAttribute('href') || '') : '';
    const targetId = href.startsWith('#') ? decodeURIComponent(href.slice(1)) : '';
    const target = targetId ? document.getElementById(targetId) : null;
    const style = link ? getComputedStyle(link) : null;
    const rect = link ? link.getBoundingClientRect() : null;
    const visible = !!(
      rect &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= -1 &&
      rect.left >= -1 &&
      rect.bottom <= window.innerHeight + 1 &&
      rect.right <= window.innerWidth + 1
    );
    return {
      exists: !!link,
      keyboardFocused: !!(link && active === link),
      href,
      targetId,
      targetFound: !!target,
      targetInMain: !!(target && main && (target === main || main.contains(target))),
      tabIndex: link ? link.tabIndex : null,
      hidden: !!(
        link &&
        (style.display === 'none' ||
          style.visibility === 'hidden' ||
          link.getAttribute('aria-hidden') === 'true')
      ),
      visibleWhenFocused: visible,
      text: link ? (link.textContent || '').trim() : '',
    };
  });

  const problems = [];
  if (!focused.exists) problems.push('skip link (a.skip-link) is missing');
  if (focused.exists && focused.hidden) problems.push('skip link is hidden from keyboard users');
  if (focused.exists && focused.tabIndex < 0) problems.push('skip link is not in the tab order');
  if (focused.exists && !focused.keyboardFocused) problems.push('first Tab did not focus the skip link');
  if (focused.exists && focused.keyboardFocused && !focused.visibleWhenFocused) {
    problems.push('skip link is not visible when it receives keyboard focus');
  }
  if (focused.exists && !focused.targetInMain) {
    problems.push(`skip link target ${focused.href || '(none)'} is not inside main`);
  }

  let landed = null;
  if (focused.keyboardFocused && focused.targetInMain) {
    await page.keyboard.press('Enter');
    const hash = `#${focused.targetId}`;
    try {
      await page.waitForFunction(
        (expected) => location.hash === expected,
        { timeout: 3000 },
        hash,
      );
    } catch {
      problems.push(`activating the skip link did not set location.hash to ${hash}`);
    }
    // Fragment scrolling settles after the hash change. Measuring on the
    // next frame reports the pre-scroll position and hides a sticky tab bar
    // covering #top.
    await new Promise((resolve) => setTimeout(resolve, 300));
    landed = await page.evaluate((targetId) => {
      const target = document.getElementById(targetId);
      const main = document.querySelector('main');
      const link = document.querySelector('a.skip-link');
      const active = document.activeElement;
      const shell = document.querySelector('.tabs-shell');
      const shellBottom = shell ? shell.getBoundingClientRect().bottom : 0;
      const rect = target ? target.getBoundingClientRect() : null;
      const focusOnTarget = !!(target && active && (active === target || target.contains(active)));
      const focusInMain = !!(
        main &&
        active &&
        active !== link &&
        (active === main || main.contains(active))
      );
      return {
        hash: location.hash,
        activeId: active && active.id ? active.id : null,
        activeTag: active ? active.tagName : null,
        focusOnTarget,
        focusInMain,
        targetTop: rect ? Math.round(rect.top) : null,
        shellBottom: Math.round(shellBottom),
        clearsTabBar: !!(rect && rect.top >= shellBottom - 1),
      };
    }, focused.targetId);

    if (!landed.focusOnTarget || !landed.focusInMain) {
      problems.push(
        `skip link did not move focus onto main content #${focused.targetId} ` +
          `(active: ${landed.activeTag || 'none'}${landed.activeId ? '#' + landed.activeId : ''})`,
      );
    }
    if (landed.focusOnTarget && !landed.clearsTabBar) {
      problems.push(
        `skip target is covered by the tab bar (target top ${landed.targetTop}px, tab bar bottom ${landed.shellBottom}px)`,
      );
    }
  }

  return {
    name: 'Skip link',
    ok: problems.length === 0,
    url,
    problems,
    ...focused,
    landed,
  };
}

async function checkMobileTabRow(page) {
  const expected = SURFACES.map((surface) => ({
    id: surface.tabId,
    name: surface.name,
  }));
  const result = await page.evaluate((tabs) => {
    const list = document.querySelector('[role="tablist"]');
    const shell = document.querySelector('.tabs-shell');
    const problems = [];
    if (!shell) problems.push('tab row (.tabs-shell) is missing');
    if (!list) problems.push('tab row is missing role=tablist');
    const found = list ? [...list.querySelectorAll('[role="tab"]')] : [];
    const details = [];
    const byId = new Map(found.map((tab) => [tab.id, tab]));
    for (const expectedTab of tabs) {
      const tab = byId.get(expectedTab.id);
      if (!tab) {
        problems.push(`tab row is missing #${expectedTab.id} (${expectedTab.name})`);
        continue;
      }
      const style = getComputedStyle(tab);
      const rect = tab.getBoundingClientRect();
      const name = (tab.textContent || '').replace(/\s+/g, ' ').trim();
      const focusable =
        tab.tabIndex >= 0 &&
        !tab.disabled &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        tab.getAttribute('aria-hidden') !== 'true';
      const inRow =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= -1 &&
        rect.right <= window.innerWidth + 1 &&
        rect.top >= -1 &&
        rect.bottom <= window.innerHeight + 1;
      const textClipped = tab.scrollWidth > tab.clientWidth + 1 || tab.scrollHeight > tab.clientHeight + 1;
      tab.focus();
      const tookFocus = document.activeElement === tab;
      if (!name) problems.push(`#${tab.id} has no accessible name`);
      if (!focusable || !tookFocus) problems.push(`#${tab.id} (${name || 'unnamed'}) is not keyboard-focusable`);
      if (!inRow) {
        problems.push(
          `#${tab.id} (${name}) is outside the ${window.innerWidth}px tab row ` +
            `(left ${Math.round(rect.left)}, right ${Math.round(rect.right)}, width ${Math.round(rect.width)})`,
        );
      }
      if (textClipped) {
        problems.push(
          `#${tab.id} (${name}) clips its label ` +
            `(scroll ${tab.scrollWidth}x${tab.scrollHeight}, client ${tab.clientWidth}x${tab.clientHeight})`,
        );
      }
      details.push({
        id: tab.id,
        name,
        focusable: focusable && tookFocus,
        inRow,
        textClipped,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      });
    }
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      tabCount: found.length,
      problems,
      details,
    };
  }, expected);

  if (result.viewportWidth < 385 || result.viewportWidth > 395) {
    result.problems.push(`expected a ~390px viewport, got ${result.viewportWidth}px`);
  }

  return {
    name: 'Mobile tab row',
    ok: result.problems.length === 0,
    ...result,
  };
}

function printStructural(check) {
  const label = check.ok ? 'PASS' : 'FAIL';
  console.log(`\n${check.name}: ${label}`);
  if (check.href) console.log(`  href=${check.href} targetInMain=${check.targetInMain} keyboardFocused=${check.keyboardFocused}`);
  if (check.landed) {
    console.log(
      `  landed active=${check.landed.activeTag || ''}${check.landed.activeId ? '#' + check.landed.activeId : ''} ` +
        `clearsTabBar=${check.landed.clearsTabBar}`,
    );
  }
  if (check.details) {
    for (const tab of check.details) {
      console.log(
        `  ${tab.id} "${tab.name}" ${tab.width}x${tab.height} @${tab.left} focusable=${tab.focusable} inRow=${tab.inRow} clipped=${tab.textClipped}`,
      );
    }
  }
  for (const problem of check.problems || []) {
    console.log(`  FAIL ${problem}`);
  }
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
  let skipLink = null;
  let mobileTabRow = null;
  try {
    const page = await browser.newPage();
    await page.setViewport(DESKTOP_VIEWPORT);
    for (const surface of SURFACES) {
      surfaces.push(await scanSurface(page, axeSource, surface, null));
    }
    skipLink = await checkSkipLink(page);

    await page.setViewport(MOBILE_VIEWPORT);
    const mobileSurface = await scanSurface(
      page,
      axeSource,
      {
        name: 'Mobile tab row',
        hash: '#tab-overview',
        panelId: 'panel-overview',
        tabId: 'tab-overview',
      },
      MOBILE_TAB_ROOT,
    );
    mobileSurface.viewport = MOBILE_VIEWPORT;
    surfaces.push(mobileSurface);
    mobileTabRow = await checkMobileTabRow(page);
    mobileTabRow.url = mobileSurface.url;
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

  for (const check of [skipLink, mobileTabRow]) {
    if (!check) continue;
    printStructural(check);
    if (!check.ok) {
      blocking.push({
        surface: check.name,
        id: check.name === 'Skip link' ? 'skip-link' : 'mobile-tab-row',
        impact: 'critical',
        detail: (check.problems || []).join('; '),
      });
    }
  }

  const mode = WARN_ONLY
    ? 'warn-only (A11Y_WARN_ONLY=1); skip link and mobile tab row still fail the run'
    : `fail on ${[...FAIL_IMPACTS].join(', ') || 'none'}`;

  const report = {
    tool: 'axe-core',
    mode,
    url: SITE_URL,
    viewport: DESKTOP_VIEWPORT,
    mobileViewport: MOBILE_VIEWPORT,
    surfaces,
    skipLink,
    mobileTabRow,
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
