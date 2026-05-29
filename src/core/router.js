let activeTabId = null;
let navToken = 0;

export function resetRouter() {
  activeTabId = null;
  navToken += 1;
}

export function setActiveTab(tabId) {
  activeTabId = tabId;
}

export async function navigateTo({ tabId, tabs = [], rootId = 'dashboard-module-root' }) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const tab = tabs.find((item) => item.id === tabId);

  if (!tab) {
    throw new Error('You do not have permission to access this module.');
  }

  if (typeof tab.init !== 'function') {
    root.innerHTML = `<section class="module-empty">Module not found.</section>`;
    return;
  }

  const currentToken = ++navToken;
  activeTabId = tabId;

  root.innerHTML = `<section class="module-empty">Loading ${escapeHtml(tab.label || tab.id)}...</section>`;

  try {
    await Promise.race([
      Promise.resolve(tab.init(rootId)),
      timeout(8000, `${tab.label || tab.id} is taking too long to load. Check connection and retry.`)
    ]);

    if (currentToken !== navToken) return;
  } catch (error) {
    console.error(`Module load failed: ${tabId}`, error);

    if (currentToken !== navToken) return;

    root.innerHTML = `
      <section class="module-empty status-bad">
        <strong>Module Load Error</strong><br />
        ${escapeHtml(error?.message || 'This module could not be loaded.')}
        <div class="button-row">
          <button id="retry-module-btn" class="btn-secondary" type="button">Retry</button>
          <button id="reload-app-btn" class="btn-primary" type="button">Reload App</button>
        </div>
      </section>
    `;

    document.getElementById('retry-module-btn')?.addEventListener('click', () => {
      navigateTo({ tabId, tabs, rootId });
    });

    document.getElementById('reload-app-btn')?.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

function timeout(ms, message) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), ms);
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}