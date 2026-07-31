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

  function hasNumericValue(object, key) {
    return object && object[key] !== undefined && Number.isFinite(Number(object[key]));
  }

  function commitMetrics(month) {
    const total = number(month?.developmentCommits);
    const product = hasNumericValue(month, 'productCommits')
      ? number(month.productCommits)
      : number(month?.productImprovements);
    const quality = hasNumericValue(month, 'qualityCommits')
      ? number(month.qualityCommits)
      : number(month?.qualityImprovements);
    const other = number(month?.otherCommits);
    const delivery = hasNumericValue(month, 'deliveryCommits')
      ? number(month.deliveryCommits)
      : Math.max(0, total - product - quality - other);

    return { total, product, quality, delivery, other };
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
      releaseCopy.textContent = 'The most recent user-facing production releases, summarized from promotion notes merged into main.';
    }

    return section;
  }

  function metricCard(label, value, note) {
    return `
      <article class="activity-metric">
        <div class="activity-metric-label">${escapeHtml(label)}</div>
        <div class="activity-metric-value">${number(value)}</div>
        <div class="activity-metric-note">${escapeHtml(note)}</div>
      </article>`;
  }

  function breakdownText(metrics) {
    const parts = [
      `${metrics.product} product`,
      `${metrics.quality} quality`,
      `${metrics.delivery} delivery`,
    ];
    if (metrics.other) parts.push(`${metrics.other} other`);
    return parts.join(' · ');
  }

  function renderTrend(months) {
    const max = Math.max(1, ...months.map((month) => commitMetrics(month).total));
    return months
      .map((month) => {
        const metrics = commitMetrics(month);
        const width = Math.max(metrics.total > 0 ? 3 : 0, Math.round((metrics.total / max) * 100));
        return `
          <div class="activity-trend-row">
            <div class="activity-month">${escapeHtml(month.label)}</div>
            <div class="activity-bar-track" aria-hidden="true"><span class="activity-bar" style="width:${width}%"></span></div>
            <div class="activity-commit-count">${metrics.total} commits</div>
            <div class="activity-detail-line">${escapeHtml(breakdownText(metrics))}</div>
          </div>`;
      })
      .join('');
  }

  function renderTable(months) {
    return `
      <div class="activity-table-wrap" tabindex="0" aria-label="Scrollable monthly activity table">
        <table class="activity-table">
          <caption>Rolling six-month Dugout Lineup commit delivery</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Commits</th>
              <th scope="col">Product</th>
              <th scope="col">Quality</th>
              <th scope="col">Delivery</th>
              <th scope="col">Other</th>
              <th scope="col">Releases</th>
            </tr>
          </thead>
          <tbody>
            ${months
              .map((month) => {
                const metrics = commitMetrics(month);
                return `
                  <tr>
                    <td>${escapeHtml(month.label)}</td>
                    <td>${metrics.total}</td>
                    <td>${metrics.product}</td>
                    <td>${metrics.quality}</td>
                    <td>${metrics.delivery}</td>
                    <td>${metrics.other}</td>
                    <td>${number(month.productionReleases)}</td>
                  </tr>`;
              })
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

    return `<ol class="activity-highlights activity-release-notes">${notes
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
    const metrics = commitMetrics(current);

    section.querySelector('[data-activity-summary]').innerHTML = [
      metricCard('Commits', metrics.total, `${currentLabel} delivery effort`),
      metricCard('Product commits', metrics.product, 'Features and experience improvements'),
      metricCard('Quality commits', metrics.quality, 'Fixes, tests, security, and reliability'),
      metricCard('Delivery commits', metrics.delivery, 'Documentation, CI, release, and maintenance work'),
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
      status.innerHTML = `Monthly activity is temporarily unavailable. <a href="https://github.com/kaushikkuberanathan/lineup_generator/commits/develop/" target="_blank" rel="noreferrer" style="color:var(--accent);font-weight:800;">View development commits on GitHub →</a>`;
      status.classList.add('error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
