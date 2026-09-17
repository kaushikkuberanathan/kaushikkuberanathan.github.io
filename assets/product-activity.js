(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function number(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  function formatGeneratedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date);
  }

  function installResumeGate() {
    const resumeLink = document.querySelector('a.social-link.resume');
    if (!resumeLink) return;

    const STORAGE_KEY = 'resumeLeadEmail';
    const endpoint = resumeLink.dataset.leadEndpoint;
    const resumeHref = resumeLink.getAttribute('href');

    function getStoredEmail() {
      try {
        return window.localStorage.getItem(STORAGE_KEY) || '';
      } catch {
        return '';
      }
    }

    function storeEmail(email) {
      try {
        window.localStorage.setItem(STORAGE_KEY, email);
      } catch {
        // Private browsing / storage disabled — the gate will just reappear next visit.
      }
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function openResume() {
      window.open(resumeHref, '_blank', 'noopener,noreferrer');
    }

    function notifyBackend(email) {
      if (!endpoint || endpoint.startsWith('PASTE_')) return;
      // Apps Script web apps don't return CORS headers, so this is a fire-and-forget
      // "no-cors" request: the script still runs server-side, we just can't read the response.
      fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          email,
          userAgent: navigator.userAgent,
          referrer: document.referrer,
          timestamp: new Date().toISOString(),
        }),
      }).catch((error) => console.error('Unable to send resume lead notification:', error));
    }

    let backdrop;
    let lastFocused;

    function buildDialog() {
      backdrop = document.createElement('div');
      backdrop.className = 'resume-gate-backdrop';
      backdrop.hidden = true;
      backdrop.innerHTML = `
        <div class="resume-gate-dialog" role="dialog" aria-modal="true" aria-labelledby="resume-gate-title" aria-describedby="resume-gate-copy">
          <h2 id="resume-gate-title">Get Kaushik's résumé</h2>
          <p id="resume-gate-copy">Enter your email to view the résumé — I'll also send you a copy.</p>
          <form class="resume-gate-form" novalidate>
            <div class="resume-gate-field">
              <label for="resume-gate-email">Email address</label>
              <input autocomplete="email" id="resume-gate-email" name="email" placeholder="you@company.com" required type="email" />
            </div>
            <div class="resume-gate-error" role="alert"></div>
            <div class="resume-gate-actions">
              <button class="resume-gate-cancel" type="button">Cancel</button>
              <button class="resume-gate-submit" type="submit">Send &amp; view résumé</button>
            </div>
          </form>
          <p class="resume-gate-note">Used only to send your copy — never shared.</p>
        </div>`;
      document.body.appendChild(backdrop);

      const form = backdrop.querySelector('form');
      const input = backdrop.querySelector('#resume-gate-email');
      const errorEl = backdrop.querySelector('.resume-gate-error');
      const submitBtn = backdrop.querySelector('.resume-gate-submit');
      const cancelBtn = backdrop.querySelector('.resume-gate-cancel');

      cancelBtn.addEventListener('click', closeDialog);
      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) closeDialog();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !backdrop.hidden) closeDialog();
      });

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = input.value.trim();
        if (!isValidEmail(email)) {
          errorEl.textContent = 'Enter a valid email address.';
          input.focus();
          return;
        }

        storeEmail(email);
        openResume();
        notifyBackend(email);
        closeDialog();
      });

      backdrop._els = { input, errorEl };
    }

    function openDialog() {
      if (!backdrop) buildDialog();
      lastFocused = document.activeElement;
      backdrop.hidden = false;
      backdrop._els.errorEl.textContent = '';
      backdrop._els.input.value = '';
      backdrop._els.input.focus();
    }

    function closeDialog() {
      if (!backdrop) return;
      backdrop.hidden = true;
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    resumeLink.addEventListener('click', (event) => {
      if (getStoredEmail()) return;
      event.preventDefault();
      openDialog();
    });
  }

  function installActivityTab() {
    const section = document.querySelector('[data-product-activity]');
    const tabs = document.querySelector('.tabs');
    if (!section || !tabs) return section;
    if (document.getElementById('tab-building')) return section;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'tab-building';
    button.className = 'tab-button';
    button.dataset.tab = 'building';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'panel-building');
    button.setAttribute('aria-selected', 'false');
    button.textContent = 'Building in Public';

    // Appended after the last static tab (Product Lab) so it reads as
    // a drill-down of that tab rather than sitting between unrelated ones.
    tabs.appendChild(button);

    const panel = document.createElement('section');
    panel.id = 'panel-building';
    panel.className = 'tab-panel activity-tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tab-building');

    const panelParent = section.closest('main');
    const footer = panelParent?.querySelector('.footer');
    if (panelParent) panelParent.insertBefore(panel, footer || null);
    panel.appendChild(section);
    section.classList.add('activity-tab-card');

    return section;
  }

  function renderSignal(months) {
    const totals = months.reduce(
      (acc, month) => {
        acc.product += number(month.productImprovements);
        acc.quality += number(month.qualityImprovements);
        acc.releases += number(month.productionReleases);
        return acc;
      },
      { product: 0, quality: 0, releases: 0 },
    );
    const total = totals.product + totals.quality;
    const qualityShare = total ? totals.quality / total : 0;

    let balance;
    if (!total) {
      balance = "It's been quiet lately — no shortage of thinking, just less shipped in this window.";
    } else if (qualityShare >= 0.7) {
      balance =
        'Recent iteration has leaned heavily toward reliability, polish, and paying down complexity — new features ship only once they\'ve earned their place.';
    } else if (qualityShare >= 0.4) {
      balance = 'Recent iteration has been a steady balance of new capability and the reliability work that keeps it trustworthy.';
    } else {
      balance = 'Recent iteration has focused on new capability, with reliability work close behind rather than an afterthought.';
    }

    const cadence = totals.releases
      ? ' It ships in a handful of deliberate, tested releases rather than a constant stream.'
      : '';

    return `${balance}${cadence}`;
  }

  function renderReleaseNotes(data, currentMonth, repository) {
    const notes = Array.isArray(data.latestReleaseNotes)
      ? data.latestReleaseNotes
      : Array.isArray(currentMonth.releaseNotes)
        ? currentMonth.releaseNotes
        : Array.isArray(currentMonth.highlights)
          ? currentMonth.highlights
          : [];

    if (!notes.length) {
      return `<p class="activity-panel-copy">No production release notes have been published in this reporting window yet.</p>`;
    }

    return `<ol class="activity-highlights activity-release-notes activity-ship-list">${notes
      .map((item) => {
        const safeUrl = item.url || `https://github.com/${repository}/pull/${number(item.number)}`;
        return `<li><a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></li>`;
      })
      .join('')}</ol>`;
  }

  function render(section, data) {
    const months = Array.isArray(data.months) ? data.months : [];
    const current = data.currentMonth || months.at(-1) || {};

    section.querySelector('[data-activity-signal]').textContent = renderSignal(months);
    section.querySelector('[data-activity-highlights]').innerHTML = renderReleaseNotes(data, current, data.repository);
    section.querySelector('[data-activity-updated]').textContent = `Updated ${formatGeneratedAt(data.generatedAt)}`;
    section.querySelector('[data-activity-status]').hidden = true;
    section.querySelector('[data-activity-content]').hidden = false;
  }

  installResumeGate();

  const installedSection = installActivityTab();

  async function init() {
    const section = installedSection || document.querySelector('[data-product-activity]');
    if (!section) return;

    const status = section.querySelector('[data-activity-status]');
    const url = section.dataset.activityUrl;
    if (!url) {
      status.textContent = 'Product activity URL is not configured.';
      status.classList.add('error');
      return;
    }

    try {
      const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Activity request returned ${response.status}`);
      const data = await response.json();
      if (data.schemaVersion !== 1 || !Array.isArray(data.months)) throw new Error('Unexpected activity data format');
      render(section, data);
    } catch (error) {
      if (String(error.message).includes('404')) {
        console.info('Product activity data has not been generated yet.');
      } else {
        console.error('Unable to load product activity:', error);
      }
      status.innerHTML = `Monthly activity is temporarily unavailable. <a href="https://github.com/kaushikkuberanathan/lineup_generator/commits/develop" target="_blank" rel="noreferrer" style="color:var(--accent);font-weight:800;">View commit activity on GitHub →</a>`;
      status.classList.add('error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
