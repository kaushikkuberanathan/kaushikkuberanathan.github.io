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

  function metricCard(label, value, note) {
    return `
      <article class="activity-metric">
        <div class="activity-metric-label">${escapeHtml(label)}</div>
        <div class="activity-metric-value">${number(value)}</div>
        <div class="activity-metric-note">${escapeHtml(note)}</div>
      </article>`;
  }

  function renderTrend(months) {
    const max = Math.max(1, ...months.map((month) => number(month.mergedPullRequests)));
    return months
      .map((month) => {
        const prs = number(month.mergedPullRequests);
        const width = Math.max(prs > 0 ? 3 : 0, Math.round((prs / max) * 100));
        return `
          <div class="activity-trend-row">
            <div class="activity-month">${escapeHtml(month.label)}</div>
            <div class="activity-bar-track" aria-hidden="true"><span class="activity-bar" style="width:${width}%"></span></div>
            <div class="activity-pr-count">${prs} PRs</div>
            <div class="activity-detail-line">
              ${number(month.productImprovements)} product ·
              ${number(month.productionReleases)} releases ·
              ${number(month.qualityImprovements)} quality
            </div>
          </div>`;
      })
      .join('');
  }

  function renderTable(months) {
    return `
      <div class="activity-table-wrap">
        <table class="activity-table">
          <caption>Rolling six-month Dugout Lineup product delivery</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Merged PRs</th>
              <th scope="col">Product</th>
              <th scope="col">Releases</th>
              <th scope="col">Quality</th>
              <th scope="col">Commits</th>
            </tr>
          </thead>
          <tbody>
            ${months
              .map(
                (month) => `
                  <tr>
                    <td>${escapeHtml(month.label)}</td>
                    <td>${number(month.mergedPullRequests)}</td>
                    <td>${number(month.productImprovements)}</td>
                    <td>${number(month.productionReleases)}</td>
                    <td>${number(month.qualityImprovements)}</td>
                    <td>${number(month.developmentCommits)}</td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderHighlights(currentMonth, repository) {
    const highlights = Array.isArray(currentMonth.highlights) ? currentMonth.highlights : [];
    if (!highlights.length) {
      return `<p class="activity-panel-copy">No product-labeled improvements have been recorded for this month yet.</p>`;
    }

    return `<ol class="activity-highlights">${highlights
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

    section.querySelector('[data-activity-summary]').innerHTML = [
      metricCard('Merged PRs', current.mergedPullRequests, `${currentLabel} completed work`),
      metricCard('Product improvements', current.productImprovements, 'User-facing features and enhancements'),
      metricCard('Production releases', current.productionReleases, 'Promotions merged into main'),
      metricCard('Quality improvements', current.qualityImprovements, 'Testing, reliability, fixes, and technical debt'),
    ].join('');

    section.querySelector('[data-activity-trend]').innerHTML = renderTrend(months);
    section.querySelector('[data-activity-table]').innerHTML = renderTable(months);
    section.querySelector('[data-activity-highlights]').innerHTML = renderHighlights(current, data.repository);
    section.querySelector('[data-activity-updated]').textContent = `Updated ${formatGeneratedAt(data.generatedAt)}`;
    section.querySelector('[data-activity-status]').hidden = true;
    section.querySelector('[data-activity-content]').hidden = false;
  }

  async function init() {
    const section = document.querySelector('[data-product-activity]');
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
      status.innerHTML = `Monthly activity is temporarily unavailable. <a href="https://github.com/kaushikkuberanathan/lineup_generator/pulls?q=is%3Apr+is%3Amerged" target="_blank" rel="noreferrer" style="color:var(--accent);font-weight:800;">View merged work on GitHub →</a>`;
      status.classList.add('error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
