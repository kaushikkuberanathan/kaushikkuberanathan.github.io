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

    const releaseTitle = section.querySelector('.activity-layout aside .activity-panel-title');
    const releaseCopy = section.querySelector('.activity-layout aside .activity-panel-copy');
    if (releaseTitle) releaseTitle.textContent = 'Latest release notes';
    if (releaseCopy) {
      releaseCopy.textContent = 'The most recent user-facing production releases, summarized from the release notes promoted into main.';
    }

    return section;
  }

  function sparkline(values) {
    const nums = Array.isArray(values) ? values.map(number) : [];
    if (nums.length < 2) return '';
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    const step = 96 / (nums.length - 1);
    const points = nums
      .map((v, i) => `${(2 + i * step).toFixed(2)},${(28 - ((v - min) / range) * 26).toFixed(2)}`)
      .join(' ');
    const last = points.split(' ').at(-1).split(',');
    return `
      <svg class="activity-metric-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="currentColor"/>
      </svg>`;
  }

  function monthShort(label) {
    return String(label ?? '').split(' ')[0] || label;
  }

  function metricCard(label, value, note, { series, accent, deltaVsPrevious } = {}) {
    const accentClass = accent ? ` metric-accent-${accent}` : '';
    const delta = number(deltaVsPrevious?.diff);
    const deltaHtml = deltaVsPrevious
      ? `<span class="activity-metric-delta${delta < 0 ? ' is-down' : ''}">${delta > 0 ? '+' : ''}${delta} vs ${escapeHtml(monthShort(deltaVsPrevious.label))}</span>`
      : '';
    return `
      <article class="activity-metric${accentClass}">
        <div class="activity-metric-label">${escapeHtml(label)}</div>
        <div class="activity-metric-num-row">
          <div class="activity-metric-value">${number(value)}</div>
          ${deltaHtml}
        </div>
        ${sparkline(series)}
        <div class="activity-metric-note">${escapeHtml(note)}</div>
      </article>`;
  }

  function renderTrend(months) {
    const max = Math.max(1, ...months.map((month) => number(month.developmentCommits)));
    return months
      .map((month) => {
        const commits = number(month.developmentCommits);
        const product = number(month.productImprovements);
        const quality = number(month.qualityImprovements);
        const releases = number(month.productionReleases);
        const productWidth = (product / max) * 100;
        const qualityWidth = (quality / max) * 100;
        return `
          <div class="activity-trend-row">
            <div class="activity-month">${escapeHtml(month.label)}</div>
            <div class="activity-bar-track" aria-hidden="true">
              <span class="activity-bar-seg activity-bar-product" style="width:${productWidth}%"></span>
              <span class="activity-bar-seg activity-bar-quality" style="left:${productWidth}%;width:${qualityWidth}%"></span>
            </div>
            <div class="activity-pr-count">${commits}</div>
            <span class="activity-release-chip${releases ? '' : ' is-zero'}" title="${releases} production release${releases === 1 ? '' : 's'}"><span class="dot" aria-hidden="true"></span>${releases}</span>
          </div>`;
      })
      .join('');
  }

  function renderTable(months) {
    return `
      <div class="activity-table-wrap" tabindex="0" aria-label="Scrollable monthly activity table">
        <table class="activity-table">
          <caption>Rolling six-month Dugout Lineup commit activity and production releases</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Commits</th>
              <th scope="col">Product</th>
              <th scope="col">Quality</th>
              <th scope="col">Releases</th>
            </tr>
          </thead>
          <tbody>
            ${months
              .map(
                (month) => `
                  <tr>
                    <td>${escapeHtml(month.label)}</td>
                    <td>${number(month.developmentCommits)}</td>
                    <td>${number(month.productImprovements)}</td>
                    <td>${number(month.qualityImprovements)}</td>
                    <td>${number(month.productionReleases)}</td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
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
    const currentLabel = current.label || 'Current month';
    const previous = months.length >= 2 ? months.at(-2) : null;
    const commitDelta = previous
      ? { diff: number(current.developmentCommits) - number(previous.developmentCommits), label: previous.label }
      : null;

    section.querySelector('[data-activity-summary]').innerHTML = [
      metricCard('Committed improvements', current.developmentCommits, `${currentLabel} individual changes`, {
        series: months.map((m) => m.developmentCommits),
        deltaVsPrevious: commitDelta,
      }),
      metricCard('Product improvements', current.productImprovements, 'Feature and customer-experience commits', {
        series: months.map((m) => m.productImprovements),
        accent: 'green',
      }),
      metricCard('Quality improvements', current.qualityImprovements, 'Fixes, tests, security, refactors, and docs', {
        series: months.map((m) => m.qualityImprovements),
        accent: 'blue',
      }),
      metricCard('Production releases', current.productionReleases, 'User-facing promotions merged into main', {
        series: months.map((m) => m.productionReleases),
        accent: 'amber',
      }),
    ].join('');

    section.querySelector('[data-activity-trend]').innerHTML = renderTrend(months);
    section.querySelector('[data-activity-table]').innerHTML = renderTable(months);
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
