import { getPendingReads, getPendingCustomers } from './offlineStore.js';
import { syncOfflineData } from './syncService.js';

export async function renderOfflineStatus(rootId = 'offline-status-root') {
  const root = document.getElementById(rootId);
  if (!root) return;

  const [reads, customers] = await Promise.all([
    getPendingReads(),
    getPendingCustomers()
  ]);

  root.innerHTML = `
    <div class="offline-status ${navigator.onLine ? 'online' : 'offline'}">
      <strong>${navigator.onLine ? 'Online' : 'Offline'}</strong>
      <span>
        Pending Reads: ${reads.length}
        • Pending Customers: ${customers.length}
      </span>

      <button id="sync-offline-btn" class="btn-secondary" type="button">
        Sync Now
      </button>
    </div>
  `;

  document.getElementById('sync-offline-btn')?.addEventListener('click', async () => {
    const result = await syncOfflineData();
    alert(`${result.message} Reads: ${result.readsSynced}, Customers: ${result.customersSynced}`);
    await renderOfflineStatus(rootId);
  });
}