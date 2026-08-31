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

  function configureResumeDownload() {
    const resumeLink = document.querySelector('a.social-link.resume');
    if (!resumeLink) return;

    resumeLink.setAttribute('download', 'Kaushik Kuberanathan.pdf');
    resumeLink.removeAttribute('target');
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

    const metricsButton = document.getElementById('tab-metrics');
    tabs.insertBefore(button, metricsButton || null);

    const panel = document.createElement('section');
    panel.id = 'panel-building';
    panel.className = 'tab-panel activity-tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tab-building');

    const metricsPanel = document.getElementById('panel-metrics');
    const panelParent = metricsPanel?.parentNode || section.closest('main');
    if (panelParent) panelParent.insertBefore(panel, metricsPanel || null);
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

  const installedSection = installActivityTab();

  async function init() {
    configureResumeDownload();

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
