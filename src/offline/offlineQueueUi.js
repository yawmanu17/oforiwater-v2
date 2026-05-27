import {
  getPendingReads,
  getPendingCustomers,
  deletePendingRead,
  deletePendingCustomer
} from './offlineStore.js';

import { syncOfflineData } from './syncService.js';

let pendingReads = [];
let pendingCustomers = [];

export async function initOfflineQueueUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  if (!root) return;

  await loadQueue();

  root.innerHTML = `
    <section class="module-page">
      <div class="module-toolbar">
        <div class="module-title-block">
          <div class="module-eyebrow">Offline Field Operations</div>
          <h2>Offline Sync Queue</h2>
          <p>Review pending meter reads and customer records saved locally while field devices are offline.</p>
        </div>

        <div class="module-actions">
          <button id="queue-sync-btn" class="btn-primary" type="button">
            Sync Now
          </button>

          <button id="queue-refresh-btn" class="btn-secondary" type="button">
            Refresh Queue
          </button>
        </div>
      </div>

      <div class="module-kpis">
        <div class="kpi-card">
          <div class="kpi-label">Connection</div>
          <div class="kpi-value">${navigator.onLine ? 'Online' : 'Offline'}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Pending Reads</div>
          <div class="kpi-value">${pendingReads.length}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Pending Customers</div>
          <div class="kpi-value">${pendingCustomers.length}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Total Queue</div>
          <div class="kpi-value">${pendingReads.length + pendingCustomers.length}</div>
        </div>
      </div>

      <div class="module-workspace">
        <section class="module-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Pending Meter Reads</h3>
              <p class="module-panel-subtitle">Readings captured offline and waiting for upload.</p>
            </div>
          </div>

          <div id="pending-read-list">
            ${pendingReadsHtml()}
          </div>
        </section>

        <section class="module-panel inspector-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Pending Customers</h3>
              <p class="module-panel-subtitle">Customer records captured offline and waiting for upload.</p>
            </div>
          </div>

          <div id="pending-customer-list">
            ${pendingCustomersHtml()}
          </div>
        </section>
      </div>
    </section>
  `;

  wireQueueEvents(rootId);
}

async function loadQueue() {
  [pendingReads, pendingCustomers] = await Promise.all([
    getPendingReads(),
    getPendingCustomers()
  ]);
}

function pendingReadsHtml() {
  if (!pendingReads.length) {
    return `<div class="module-empty">No pending meter reads.</div>`;
  }

  return `
    <div class="compact-list">
      ${pendingReads.map((read) => `
        <div class="mini-card">
          <strong>${safe(read.account_number || read.customer_id || 'Meter Read')}</strong><br />
          <small>
            Month: ${safe(read.billing_month || '—')}
            • Previous: ${safe(read.previous_read ?? '—')}
            • Current: ${safe(read.current_read ?? '—')}
          </small><br />
          <small>
            Usage: ${safe(read.usage_ccf ?? '—')} CCF
            • Saved: ${formatDate(read.created_offline_at)}
          </small>

          <div class="button-row">
            <button
              class="btn-secondary danger-btn delete-pending-read-btn"
              type="button"
              data-local-id="${safe(read.local_id)}"
            >
              Remove
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function pendingCustomersHtml() {
  if (!pendingCustomers.length) {
    return `<div class="module-empty">No pending customers.</div>`;
  }

  return `
    <div class="compact-list">
      ${pendingCustomers.map((customer) => `
        <div class="mini-card">
          <strong>${safe(customer.account_number || 'Customer')}</strong><br />
          <small>
            ${safe(customer.customer_name || 'Unnamed')}
            • ${safe(customer.customer_class || '—')}
          </small><br />
          <small>
            Address: ${safe(customer.service_address || '—')}
          </small><br />
          <small>
            Saved: ${formatDate(customer.created_offline_at)}
          </small>

          <div class="button-row">
            <button
              class="btn-secondary danger-btn delete-pending-customer-btn"
              type="button"
              data-local-id="${safe(customer.local_id)}"
            >
              Remove
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function wireQueueEvents(rootId) {
  document.getElementById('queue-refresh-btn')?.addEventListener('click', async () => {
    await initOfflineQueueUi(rootId);
  });

  document.getElementById('queue-sync-btn')?.addEventListener('click', async () => {
    const result = await syncOfflineData();

    alert(`${result.message} Reads synced: ${result.readsSynced}. Customers synced: ${result.customersSynced}.`);

    await initOfflineQueueUi(rootId);
  });

  document.querySelectorAll('.delete-pending-read-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = confirm('Remove this pending meter read from the offline queue?');
      if (!confirmed) return;

      await deletePendingRead(button.dataset.localId);
      await initOfflineQueueUi(rootId);
    });
  });

  document.querySelectorAll('.delete-pending-customer-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = confirm('Remove this pending customer from the offline queue?');
      if (!confirmed) return;

      await deletePendingCustomer(button.dataset.localId);
      await initOfflineQueueUi(rootId);
    });
  });
}

function formatDate(value) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}