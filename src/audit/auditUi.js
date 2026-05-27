import { authState } from '../auth/auth.js';
import { getAuditLogsByUtility } from '../supabase/auditLogs.js';

export async function initAuditUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  root.innerHTML = `
    <section class="card section-card">
      <h2>Audit Logs</h2>
      <p>Review recent platform activity by users, modules, and records.</p>

      <div class="button-row">
        <button id="refresh-audit-btn" class="btn-secondary" type="button">
          Refresh Logs
        </button>
      </div>
    </section>

    <section class="card section-card">
      <h2>Recent Activity</h2>
      <div id="audit-log-list"></div>
    </section>
  `;

  document
    .getElementById('refresh-audit-btn')
    ?.addEventListener('click', refreshLogs);

  await refreshLogs();
}

async function refreshLogs() {
  const list = document.getElementById('audit-log-list');
  const utility = authState.utility;

  if (!list || !utility?.id) return;

  const logs = await getAuditLogsByUtility(utility.id);

  if (!logs.length) {
    list.innerHTML = '<p>No audit logs yet.</p>';
    return;
  }

  list.innerHTML = logs.map((log) => `
    <div class="mini-card">
      <strong>${safe(log.action)} — ${safe(log.entity_type)}</strong><br />
      <span>${safe(log.description || '')}</span><br />
      <small>
        User: ${safe(log.profiles?.full_name || log.profiles?.email || 'Unknown')}
        • Role: ${safe(log.profiles?.role || '—')}
        • ${formatDate(log.created_at)}
      </small>
    </div>
  `).join('');
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
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