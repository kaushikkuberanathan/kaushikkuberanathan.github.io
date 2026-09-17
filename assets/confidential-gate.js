(function () {
  'use strict';

  // Must match scripts/encrypt-confidential.js exactly.
  const ITERATIONS = 200000;
  const HASH = 'SHA-256';
  const ASSET_URL = 'assets/confidential-projects.json';

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function installConfidentialTab() {
    const tabs = document.querySelector('.tabs');
    const main = document.querySelector('main.page');
    if (!tabs || !main) return null;
    if (document.getElementById('tab-confidential')) return document.getElementById('panel-confidential');

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'tab-confidential';
    button.className = 'tab-button';
    button.dataset.tab = 'confidential';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'panel-confidential');
    button.setAttribute('aria-selected', 'false');
    button.innerHTML = '<span aria-hidden="true">&#128274;</span> Confidential Projects';
    // Sits right after Enterprise Impact -- it's a gated deep-dive on those
    // same initiatives, not a Product Lab drill-down.
    const enterpriseButton = document.getElementById('tab-enterprise');
    if (enterpriseButton) {
      enterpriseButton.insertAdjacentElement('afterend', button);
    } else {
      tabs.appendChild(button);
    }

    const panel = document.createElement('section');
    panel.id = 'panel-confidential';
    panel.className = 'tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tab-confidential');
    panel.innerHTML = `
      <section class="card confidential-card" aria-labelledby="confidential-title">
        <h2 class="section-title" id="confidential-title">Confidential Projects</h2>
        <p class="section-intro">Detailed reports on select initiatives and the problems they solved &mdash; kept access-gated because the specifics are proprietary. Enter the access password to view, or request access below.</p>
        <div class="confidential-gate" data-confidential-gate>
          <form class="confidential-gate-form" data-confidential-form novalidate>
            <label for="confidential-password">Access password</label>
            <div class="confidential-gate-row">
              <input id="confidential-password" name="password" type="password" autocomplete="off" placeholder="Enter password" data-confidential-input required />
              <button type="submit" class="confidential-unlock-btn" data-confidential-submit>Unlock</button>
            </div>
            <div class="confidential-gate-error" role="alert" data-confidential-error></div>
          </form>
          <div class="confidential-gate-request">
            <span>Don't have the password?</span>
            <a class="social-link email" href="mailto:kaushik.kuberanathan@gmail.com?subject=Confidential%20Projects%20access%20request" aria-label="Request access to Confidential Projects by email">
              <svg aria-hidden="true" viewBox="0 0 24 24"><rect class="mark-bg" height="24" rx="5" width="24"></rect><path d="M5 8.2h14v8.1H5z" fill="none" stroke="#172033" stroke-width="1.7"></path><path d="M5.5 8.7 12 13l6.5-4.3" fill="none" stroke="#172033" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"></path></svg>
              Request access
            </a>
          </div>
        </div>
        <div class="confidential-content" data-confidential-content hidden></div>
      </section>`;

    const panelParent = main;
    const footer = panelParent.querySelector('.footer');
    panelParent.insertBefore(panel, footer || null);

    return panel;
  }

  async function fetchPayload() {
    const response = await fetch(ASSET_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Confidential asset request returned ${response.status}`);
    return response.json();
  }

  async function decryptPayload(payload, password) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('unsupported');
    }
    const salt = base64ToBytes(payload.salt);
    const iv = base64ToBytes(payload.iv);
    const ciphertext = base64ToBytes(payload.ciphertext);

    const passKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
      'deriveKey',
    ]);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: payload.iterations || ITERATIONS, hash: HASH },
      passKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plaintextBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const plaintext = new TextDecoder().decode(plaintextBuffer);
    return JSON.parse(plaintext);
  }

  function statusPillClass(status) {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'shipped') return 'green';
    if (normalized === 'in progress') return 'amber';
    return 'gray';
  }

  function reportSection(label, colorClass, innerHtml) {
    if (!innerHtml) return '';
    return `
      <div class="confidential-report-section">
        <span class="confidential-report-label ${colorClass}">${label}</span>
        ${innerHtml}
      </div>`;
  }

  function renderReports(container, data) {
    const reports = Array.isArray(data.reports) ? data.reports : [];
    const updated = data.updated ? `<p class="confidential-updated">Updated ${escapeHtml(data.updated)}</p>` : '';
    const cards = reports
      .map((report) => {
        const accomplishments = Array.isArray(report.accomplishments)
          ? `<ul class="confidential-report-list">${report.accomplishments
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join('')}</ul>`
          : '';
        const statusHtml = report.status
          ? `<span class="pill ${statusPillClass(report.status)} confidential-status-pill">${escapeHtml(report.status)}</span>`
          : '';
        return `
        <article class="confidential-report-card">
          <div class="confidential-report-head">
            <h3>${escapeHtml(report.title)}</h3>
            <div class="confidential-report-meta">
              ${statusHtml}
              <span class="pill purple">${escapeHtml(report.tag || 'Confidential')}</span>
            </div>
          </div>
          <div class="confidential-report-body">
            ${reportSection('Background', 'blue', report.background ? `<p>${escapeHtml(report.background)}</p>` : '')}
            ${reportSection('Problem', 'red', report.problem ? `<p>${escapeHtml(report.problem)}</p>` : '')}
            ${reportSection('Approach', 'purple', report.approach ? `<p>${escapeHtml(report.approach)}</p>` : '')}
            ${reportSection('Accomplishments', 'green', accomplishments)}
            ${reportSection('Outcome', 'amber', report.outcome ? `<p>${escapeHtml(report.outcome)}</p>` : '')}
          </div>
        </article>`;
      })
      .join('');
    container.innerHTML = `${updated}<div class="confidential-report-grid">${cards}</div>`;
  }

  function installGate(panel) {
    const gate = panel.querySelector('[data-confidential-gate]');
    const content = panel.querySelector('[data-confidential-content]');
    const form = panel.querySelector('[data-confidential-form]');
    const input = panel.querySelector('[data-confidential-input]');
    const errorEl = panel.querySelector('[data-confidential-error]');
    const submitBtn = panel.querySelector('[data-confidential-submit]');
    if (!gate || !content || !form || !input || !errorEl || !submitBtn) return;

    let cachedPayload = null;
    let failedAttempts = 0;

    function setError(message) {
      errorEl.textContent = message;
    }

    function lockOutFor(seconds) {
      submitBtn.disabled = true;
      input.disabled = true;
      const originalLabel = 'Unlock';
      let remaining = seconds;
      submitBtn.textContent = `Try again in ${remaining}s`;
      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(timer);
          submitBtn.disabled = false;
          input.disabled = false;
          submitBtn.textContent = originalLabel;
          input.focus();
        } else {
          submitBtn.textContent = `Try again in ${remaining}s`;
        }
      }, 1000);
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = input.value;
      if (!password) return;

      setError('');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Unlocking…';

      try {
        if (!cachedPayload) cachedPayload = await fetchPayload();
        const data = await decryptPayload(cachedPayload, password);
        renderReports(content, data);
        content.hidden = false;
        gate.hidden = true;
        return;
      } catch (error) {
        if (error && error.message === 'unsupported') {
          setError('This browser does not support the secure unlock feature. Try a recent Chrome, Edge, Firefox, or Safari.');
        } else if (error && error.message && error.message.startsWith('Confidential asset request')) {
          setError('Confidential content is temporarily unavailable. Please try again shortly.');
        } else {
          failedAttempts += 1;
          setError('Incorrect password.');
          input.value = '';
          input.focus();
          if (failedAttempts >= 3) {
            lockOutFor(Math.min(5 * (failedAttempts - 2), 30));
            return;
          }
        }
      }

      submitBtn.disabled = false;
      submitBtn.textContent = 'Unlock';
    });
  }

  // Installed synchronously (not deferred to DOMContentLoaded) so the tab
  // and panel exist in the DOM before the inline tab-switching script at the
  // bottom of index.html takes its buttons/panels snapshot.
  const installedPanel = installConfidentialTab();
  if (installedPanel) installGate(installedPanel);
})();
