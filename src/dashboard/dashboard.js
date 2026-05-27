import { authState } from '../auth/auth.js';
import { getAllowedTabs } from '../auth/permissions.js';
import { navigateTo, resetRouter } from '../core/router.js';

import { initCustomerMeterSetup } from './customerMeterSetup.js';
import { initAssetSetup } from './assetSetup.js';
import { getDashboardKpis } from './kpiService.js';

import { initFieldMeterReads } from '../field/meterReads.js';
import { initMapView } from '../gis/mapView.js';
import { initBillingUi } from '../billing/billingUi.js';
import { initNrwUi } from '../nrw/nrwUi.js';
import { renderOfflineStatus } from '../offline/offlineUi.js';
import { initAdjustmentsUi } from '../billing/adjustmentsUi.js';
import { initBillingReportsUi } from '../billing/billingReportsUi.js';
import { initMeterCalibration } from '../field/meterCalibration.js';
import { initRouteManager } from '../field/routeManager.js';
import { initAnalyticsUi } from '../analytics/analyticsUi.js';
import { initAuditUi } from '../audit/auditUi.js';
import { initImportExportUi } from '../data/importExportUi.js';
import { initOfflineQueueUi } from '../offline/offlineQueueUi.js';
import { initUtilitySetup } from './utilitySetup.js';
import { applyUtilityTheme } from '../ui/theme.js';
import { initTeamUsersUi } from './teamUsers.js';

const TAB_CONFIG = [
  { id: 'dashboard', label: 'Dashboard', init: renderDashboardHome },
  { id: 'utility', label: 'Utility Setup', init: initUtilitySetup },
  { id: 'customers', label: 'Customers', init: initCustomerMeterSetup },
  { id: 'field', label: 'Meter Reads', init: initFieldMeterReads },
  { id: 'map', label: 'Map', init: initMapView },
  { id: 'assets', label: 'Assets', init: initAssetSetup },
  { id: 'billing', label: 'Billing & Revenue', init: initBillingUi },
  { id: 'nrw', label: 'NRW', init: initNrwUi },
  { id: 'adjustments', label: 'Adjustments', init: initAdjustmentsUi },
  { id: 'billing_reports', label: 'Reports', init: initBillingReportsUi },
  { id: 'meter_calibration', label: 'Calibration', init: initMeterCalibration },
  { id: 'routes', label: 'Routes', init: initRouteManager },
  { id: 'analytics', label: 'Analytics', init: initAnalyticsUi },
  { id: 'audit', label: 'Audit', init: initAuditUi },
  { id: 'data', label: 'Import / Export', init: initImportExportUi },
  { id: 'offline_queue', label: 'Offline Queue', init: initOfflineQueueUi },
  { id: 'team', label: 'Team', init: initTeamUsersUi }
];

let offlineListenersAttached = false;

export async function initDashboard() {
  const root = document.getElementById('utility-setup-root');
  if (!root) return;

  if (!authState.user || !authState.profile || !authState.utility) {
    root.innerHTML = `<p>Loading utility workspace...</p>`;
    return;
    applyUtilityTheme(authState.utility);
  }

  const role = authState.profile.role;
  const allowedTabs = getAllowedTabs(role);
  const visibleTabs = TAB_CONFIG.filter((tab) => allowedTabs.includes(tab.id));
  const defaultTab = visibleTabs[0];

  root.innerHTML = `
    <section class="dashboard-shell">
      <div id="dashboard-module-root"></div>
    </section>
  `;

  renderSidebar(visibleTabs);
  attachOfflineListeners();
  resetRouter();

  if (defaultTab) {
    setSidebarActive(defaultTab.id);

    await navigateTo({
      tabId: defaultTab.id,
      tabs: visibleTabs,
      rootId: 'dashboard-module-root'
    });
  }
}

async function renderDashboardHome(rootId = 'dashboard-module-root') {
  const moduleRoot = document.getElementById(rootId);
  if (!moduleRoot || !authState.utility?.id) return;

  const kpis = await getDashboardKpis(authState.utility.id);

  moduleRoot.innerHTML = `
    <section class="dashboard-home">
      <div class="dashboard-topbar">
        <div class="dashboard-title-group">
          <h1>Dashboard</h1>
          <p>
            ${safe(authState.utility.name)}
            • Field-to-Desk Utility Operations
          </p>
        </div>

        <div id="offline-status-root"></div>
      </div>

      <div class="dashboard-summary compact-kpis">
        <div class="summary-card">
          <span>Customers</span>
          <strong>${kpis.customerCount}</strong>
        </div>

        <div class="summary-card">
          <span>DMAs</span>
          <strong>${kpis.dmaCount}</strong>
        </div>

        <div class="summary-card">
          <span>Reads</span>
          <strong>${kpis.readCount}</strong>
        </div>

        <div class="summary-card">
          <span>Receipts</span>
          <strong>${kpis.receiptCount}</strong>
        </div>

        <div class="summary-card">
          <span>NRW</span>
          <strong>${Number(kpis.latestNrwPercent || 0).toFixed(2)}%</strong>
        </div>
      </div>

      <section class="module-panel">
        <div class="module-panel-header">
          <div>
            <h3 class="module-panel-title">Operational Snapshot</h3>
            <p class="module-panel-subtitle">
              Key utility activity, billing readiness, field reads, and NRW indicators.
            </p>
          </div>
        </div>

        <div class="module-kpis">
          <div class="kpi-card">
            <div class="kpi-label">Field Completion</div>
            <div class="kpi-value">${kpis.readCount}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Billing Records</div>
            <div class="kpi-value">${kpis.receiptCount}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">DMA Coverage</div>
            <div class="kpi-value">${kpis.dmaCount}</div>
          </div>
        </div>
      </section>
    </section>
  `;

  await renderOfflineStatus('offline-status-root');
}

function renderSidebar(visibleTabs) {
  const navRoot = document.getElementById('sidebar-nav-root');
  if (!navRoot) return;

  navRoot.innerHTML = `
    <nav class="sidebar-nav">
      ${visibleTabs.map((tab, index) => `
        <button
          class="sidebar-btn ${index === 0 ? 'active' : ''}"
          data-tab="${safe(tab.id)}"
          type="button"
        >
          ${safe(tab.label)}
        </button>
      `).join('')}
    </nav>
  `;

  document.querySelectorAll('.sidebar-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const tabId = button.dataset.tab;
      const moduleRoot = document.getElementById('dashboard-module-root');

      if (!tabId || !moduleRoot) return;

      setSidebarActive(tabId);

      await navigateTo({
        tabId,
        tabs: visibleTabs,
        rootId: 'dashboard-module-root'
      });
    });
  });
}

function setSidebarActive(tabId) {
  document.querySelectorAll('.sidebar-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabId);
  });
}

function attachOfflineListeners() {
  if (offlineListenersAttached) return;

  window.addEventListener('online', () => {
    renderOfflineStatus('offline-status-root');
  });

  window.addEventListener('offline', () => {
    renderOfflineStatus('offline-status-root');
  });

  offlineListenersAttached = true;
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