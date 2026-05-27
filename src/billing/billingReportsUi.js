import { authState } from '../auth/auth.js';
import {
  getBillingReceiptsByMonth,
  summarizeBillingReceipts
} from '../supabase/billingReports.js';

let currentReceipts = [];

export async function initBillingReportsUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  render(root);
  wireEvents();
  await loadReport();
}

function render(root) {
  root.innerHTML = `
    <section class="module-page">
      <div class="module-toolbar">
        <div class="module-title-block">
          <h2>Billing Reports</h2>
          <p>Review billed revenue, usage, taxes, fees, customer classes, and monthly receipt activity.</p>
        </div>

        <div class="module-actions">
          <label>Billing Month
            <input id="billing-report-month" type="month" value="${currentMonth()}" />
          </label>

          <button id="load-billing-report-btn" class="btn-primary" type="button">
            Load Report
          </button>

          <button id="export-billing-report-btn" class="btn-secondary" type="button">
            Export CSV
          </button>
        </div>
      </div>

      <div id="billing-report-summary"></div>

      <div class="module-workspace">
        <section class="module-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Receipt Details</h3>
              <p class="module-panel-subtitle">Customer-level billing output for the selected month.</p>
            </div>
          </div>

          <div id="billing-report-details"></div>
        </section>

        <section class="module-panel inspector-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Customer Class Summary</h3>
              <p class="module-panel-subtitle">Revenue and usage grouped by class.</p>
            </div>
          </div>

          <div id="billing-class-summary"></div>
        </section>
      </div>
    </section>
  `;
}

function wireEvents() {
  document.getElementById('load-billing-report-btn')?.addEventListener('click', loadReport);
  document.getElementById('billing-report-month')?.addEventListener('change', loadReport);
  document.getElementById('export-billing-report-btn')?.addEventListener('click', exportCsv);
}

async function loadReport() {
  const utility = authState.utility;
  const month = val('billing-report-month');

  if (!utility?.id || !month) return;

  currentReceipts = await getBillingReceiptsByMonth(utility.id, month);
  const summary = summarizeBillingReceipts(currentReceipts);

  renderSummary(summary);
  renderDetails(currentReceipts);
  renderClassSummary(currentReceipts);
}

function renderSummary(summary) {
  const root = document.getElementById('billing-report-summary');
  if (!root) return;

  root.innerHTML = `
    <div class="module-kpis">
      <div class="kpi-card">
        <div class="kpi-label">Receipts</div>
        <div class="kpi-value">${summary.receiptCount}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Total Due</div>
        <div class="kpi-value">${formatMoney(summary.totalDue)}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Water</div>
        <div class="kpi-value">${formatMoney(summary.waterCharge)}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Sewer</div>
        <div class="kpi-value">${formatMoney(summary.sewerCharge)}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Taxes</div>
        <div class="kpi-value">${formatMoney(summary.taxes)}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Usage</div>
        <div class="kpi-value">${Number(summary.usageCcf || 0).toLocaleString()} CCF</div>
      </div>
    </div>
  `;
}

function renderDetails(receipts) {
  const root = document.getElementById('billing-report-details');
  if (!root) return;

  if (!receipts.length) {
    root.innerHTML = '<div class="module-empty">No receipts found for this month.</div>';
    return;
  }

  root.innerHTML = `
    <div class="module-table-wrap">
      <table class="table-clean">
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Customer</th>
            <th>Class</th>
            <th>Usage</th>
            <th>Water</th>
            <th>Sewer</th>
            <th>Taxes</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${receipts.map((receipt) => `
            <tr>
              <td><strong>${safe(receipt.receipt_number)}</strong></td>
              <td>
                ${safe(receipt.customers?.account_number || 'No Account')}<br />
                <small>${safe(receipt.customers?.customer_name || 'Unnamed')}</small>
              </td>
              <td>${safe(receipt.customers?.customer_class || '—')}</td>
              <td>${Number(receipt.usage_ccf || 0).toFixed(2)} CCF</td>
              <td>${formatMoney(receipt.water_charge)}</td>
              <td>${formatMoney(receipt.sewer_charge)}</td>
              <td>${formatMoney(receipt.taxes)}</td>
              <td><strong>${formatMoney(receipt.total_due)}</strong></td>
              <td>
                <span class="status-badge ${statusClass(receipt.status)}">
                  ${safe(receipt.status || 'draft')}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderClassSummary(receipts) {
  const root = document.getElementById('billing-class-summary');
  if (!root) return;

  if (!receipts.length) {
    root.innerHTML = '<div class="module-empty">No class summary available.</div>';
    return;
  }

  const groups = {};

  receipts.forEach((receipt) => {
    const customerClass = receipt.customers?.customer_class || 'Unclassified';

    if (!groups[customerClass]) {
      groups[customerClass] = {
        count: 0,
        usageCcf: 0,
        totalDue: 0
      };
    }

    groups[customerClass].count += 1;
    groups[customerClass].usageCcf += Number(receipt.usage_ccf || 0);
    groups[customerClass].totalDue += Number(receipt.total_due || 0);
  });

  root.innerHTML = `
    <div class="compact-list">
      ${Object.entries(groups).map(([customerClass, item]) => `
        <div class="mini-card">
          <strong>${safe(customerClass)}</strong><br />
          <small>
            Receipts: ${item.count}
            • Usage: ${item.usageCcf.toFixed(2)} CCF
            • Revenue: ${formatMoney(item.totalDue)}
          </small>
        </div>
      `).join('')}
    </div>
  `;
}

function exportCsv() {
  if (!currentReceipts.length) {
    alert('No report data to export.');
    return;
  }

  const headers = [
    'Receipt Number',
    'Account Number',
    'Customer Name',
    'Customer Class',
    'Billing Month',
    'Usage CCF',
    'Water Charge',
    'Sewer Charge',
    'Taxes',
    'Total Due',
    'Status'
  ];

  const rows = currentReceipts.map((receipt) => [
    receipt.receipt_number,
    receipt.customers?.account_number || '',
    receipt.customers?.customer_name || '',
    receipt.customers?.customer_class || '',
    receipt.billing_month,
    receipt.usage_ccf || 0,
    receipt.water_charge || 0,
    receipt.sewer_charge || 0,
    receipt.taxes || 0,
    receipt.total_due || 0,
    receipt.status || 'draft'
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `billing-report-${val('billing-report-month') || currentMonth()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function statusClass(status = '') {
  const normalized = status.toLowerCase();

  if (['paid', 'complete', 'completed'].includes(normalized)) return 'status-ok';
  if (['overdue', 'failed', 'cancelled'].includes(normalized)) return 'status-bad';

  return 'status-warn';
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
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