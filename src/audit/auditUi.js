import { authState } from '../auth/auth.js';
import { getAuditLogsByUtility } from '../supabase/auditLogs.js';
import { requireTabAccess } from '../auth/permissions.js';
import { showError, showSuccess } from '../ui/toast.js';

let latestLogs = [];

export async function initAuditUi(rootId = 'dashboard-module-root') {
  requireTabAccess('audit');

  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  root.innerHTML = `
    <section class="module-page">
      <div class="module-toolbar">
        <div class="module-title-block">
          <div class="module-eyebrow">Governance & Traceability</div>
          <h2>Audit Logs</h2>
          <p>
            Review platform activity across staff, customers, billing, GIS, utility setup, and security events.
          </p>
        </div>

        <div class="module-actions">
          <button id="refresh-audit-btn" class="btn-secondary" type="button">
            Refresh Logs
          </button>
        </div>
      </div>

      <div class="module-kpis">
        <div class="kpi-card">
          <div class="kpi-label">Total Events</div>
          <div id="audit-total-events" class="kpi-value">0</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Today</div>
          <div id="audit-events-today" class="kpi-value">0</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Users</div>
          <div id="audit-users-count" class="kpi-value">0</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Entity Types</div>
          <div id="audit-entity-count" class="kpi-value">0</div>
        </div>
      </div>

      <section class="module-panel">
        <div class="module-panel-header">
          <div>
            <h3 class="module-panel-title">Filters</h3>
            <p class="module-panel-subtitle">
              Filter events by action, entity type, or user email.
            </p>
          </div>
        </div>

        <div class="form-grid">
          <label>Action
            <input id="audit-filter-action" placeholder="customer_created, utility_updated..." />
          </label>

          <label>Entity Type
            <input id="audit-filter-entity" placeholder="customer, utility, staff_invite..." />
          </label>

          <label>User Email
            <input id="audit-filter-user" placeholder="user@utility.com" />
          </label>
        </div>

        <div class="button-row">
          <button id="apply-audit-filter-btn" class="btn-primary" type="button">
            Apply Filter
          </button>

          <button id="clear-audit-filter-btn" class="btn-secondary" type="button">
            Clear
          </button>
        </div>
      </section>

      <section class="module-panel">
        <div class="module-panel-header">
          <div>
            <h3 class="module-panel-title">Recent Activity</h3>
            <p class="module-panel-subtitle">
              Latest recorded events for this utility.
            </p>
          </div>
        </div>

        <div id="audit-log-list"></div>
      </section>
    </section>
  `;

  wireEvents(rootId);
  await refreshLogs();
}

function wireEvents(rootId) {
  document
    .getElementById('refresh-audit-btn')
    ?.addEventListener('click', async () => {
      await refreshLogs();
      showSuccess('Audit logs refreshed.');
    });

  document
    .getElementById('apply-audit-filter-btn')
    ?.addEventListener('click', renderFilteredLogs);

  document
    .getElementById('clear-audit-filter-btn')
    ?.addEventListener('click', () => {
      setValue('audit-filter-action', '');
      setValue('audit-filter-entity', '');
      setValue('audit-filter-user', '');
      renderLogs(latestLogs);
    });
}

async function refreshLogs() {
  const utility = authState.utility;

  try {
    latestLogs = await getAuditLogsByUtility(utility.id);

    renderKpis(latestLogs);
    renderLogs(latestLogs);
  } catch (error) {
    console.error('Audit logs failed:', error);
    showError(error.message || 'Could not load audit logs.');
  }
}

function renderFilteredLogs() {
  const action = val('audit-filter-action').toLowerCase();
  const entity = val('audit-filter-entity').toLowerCase();
  const user = val('audit-filter-user').toLowerCase();

  const filtered = latestLogs.filter((log) => {
    const logAction = String(log.action || '').toLowerCase();
    const logEntity = String(log.entity_type || '').toLowerCase();
    const logUser = String(log.actor_email || log.profiles?.email || '').toLowerCase();

    return (
      (!action || logAction.includes(action)) &&
      (!entity || logEntity.includes(entity)) &&
      (!user || logUser.includes(user))
    );
  });

  renderLogs(filtered);
}

function renderKpis(logs) {
  const today = new Date().toDateString();

  const todayCount = logs.filter((log) =>
    new Date(log.created_at).toDateString() === today
  ).length;

  const users = new Set(
    logs.map((log) => log.actor_email || log.profiles?.email).filter(Boolean)
  );

  const entities = new Set(
    logs.map((log) => log.entity_type).filter(Boolean)
  );

  setText('audit-total-events', logs.length);
  setText('audit-events-today', todayCount);
  setText('audit-users-count', users.size);
  setText('audit-entity-count', entities.size);
}

function renderLogs(logs) {
  const list = document.getElementById('audit-log-list');

  if (!list) return;

  if (!logs.length) {
    list.innerHTML = `
      <div class="module-empty">
        No audit logs match the current view.
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>User</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>
          ${logs.map((log) => `
            <tr>
              <td>${safe(formatDate(log.created_at))}</td>

              <td>
                <strong>${safe(log.actor_email || log.profiles?.email || 'Unknown')}</strong><br />
                <small>${safe(log.profiles?.role || '')}</small>
              </td>

              <td>
                <span class="status-badge status-ok">
                  ${safe(log.action)}
                </span>
              </td>

              <td>
                ${safe(log.entity_type || '—')}<br />
                <small>${safe(log.entity_id || '')}</small>
              </td>

              <td>
                <small>${safe(formatDetails(log.details))}</small>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function formatDetails(details) {
  if (!details) return '—';

  if (typeof details === 'string') {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return '—';
  }
}

function formatDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString();
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function setValue(id, value) {
  const el = document.getElementById(id);

  if (el) el.value = value;
}

function setText(id, value) {
  const el = document.getElementById(id);

  if (el) el.textContent = value;
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