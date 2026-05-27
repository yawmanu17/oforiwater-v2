import { authState } from '../auth/auth.js';
import { getDmasByUtility } from '../supabase/dmas.js';
import { getCustomersByUtility } from '../supabase/customers.js';
import { getMeterReadsByMonth } from '../supabase/meterReads.js';
import { getMasterMetersByUtility } from '../supabase/assets.js';
import {
  ccfToGallons,
  calculateNrw,
  getNrwStatus,
  getNrwStatusClass,
  formatGallons,
  formatPercent,
  numberOrZero
} from '../utils/calculations.js';

let dmas = [];
let customers = [];
let reads = [];
let masterMeters = [];

export async function initNrwUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  const billingMonth = currentMonth();

  [dmas, customers, reads, masterMeters] = await Promise.all([
    getDmasByUtility(utility.id),
    getCustomersByUtility(utility.id),
    getMeterReadsByMonth(utility.id, billingMonth),
    getMasterMetersByUtility(utility.id)
  ]);

  render(root, billingMonth);
  wireEvents();
}

function render(root, billingMonth) {
  const models = buildDmaNrwModels();
  const totals = summarizeModels(models);

  root.innerHTML = `
    <section class="module-page">
      <div class="module-toolbar">
        <div class="module-title-block">
          <div class="module-eyebrow">Water Loss Intelligence</div>
          <h2>NRW Analytics</h2>
          <p>
            Compare master meter inflow against billed customer consumption by DMA to identify non-revenue water,
            leakage risk, meter gaps, and operational losses.
          </p>
        </div>

        <div class="module-actions">
          <label>Billing Month
            <input id="nrw-billing-month" type="month" value="${safe(billingMonth)}" />
          </label>
          <button id="refresh-nrw-btn" class="btn-primary" type="button">Refresh NRW</button>
        </div>
      </div>

      <div class="module-kpis">
        <div class="kpi-card">
          <div class="kpi-label">Master Inflow</div>
          <div class="kpi-value">${formatGallons(totals.masterFlowGal)}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Billed Usage</div>
          <div class="kpi-value">${formatGallons(totals.billedUsageGal)}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">NRW Volume</div>
          <div class="kpi-value">${formatGallons(totals.nrwGal)}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">NRW %</div>
          <div class="kpi-value">${formatPercent(totals.nrwPercent)}</div>
        </div>
      </div>

      <div class="module-workspace single">
        <section class="module-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">DMA Water Balance</h3>
              <p class="module-panel-subtitle">
                Master meter flow minus billed customer usage. High NRW values require field verification.
              </p>
            </div>
          </div>

          ${dmaTableHtml(models)}
        </section>
      </div>
    </section>
  `;
}

function buildDmaNrwModels() {
  return dmas.map((dma) => {
    const dmaCustomers = customers.filter((customer) => customer.dma_id === dma.id);

    const dmaCustomerIds = new Set(dmaCustomers.map((customer) => customer.id));

    const dmaReads = reads.filter((read) => dmaCustomerIds.has(read.customer_id));

    const billedUsageGal = dmaReads.reduce((sum, read) => {
      if (numberOrZero(read.usage_gal) > 0) return sum + numberOrZero(read.usage_gal);
      return sum + ccfToGallons(read.usage_ccf);
    }, 0);

    const dmaMasterMeters = masterMeters.filter((meter) => meter.dma_id === dma.id);

    const masterFlowGal = dmaMasterMeters.reduce((sum, meter) => {
      return sum + numberOrZero(meter.monthly_flow_gal);
    }, 0);

    const nrw = calculateNrw({
      masterFlowGal,
      billedUsageGal
    });

    return {
      dma,
      customerCount: dmaCustomers.length,
      readCount: dmaReads.length,
      masterMeterCount: dmaMasterMeters.length,
      ...nrw,
      status: getNrwStatus(nrw.nrwPercent),
      statusClass: getNrwStatusClass(nrw.nrwPercent)
    };
  });
}

function summarizeModels(models) {
  const masterFlowGal = models.reduce((sum, item) => sum + item.masterFlowGal, 0);
  const billedUsageGal = models.reduce((sum, item) => sum + item.authorizedGal, 0);
  const nrwGal = Math.max(masterFlowGal - billedUsageGal, 0);
  const nrwPercent = masterFlowGal > 0 ? (nrwGal / masterFlowGal) * 100 : 0;

  return {
    masterFlowGal,
    billedUsageGal,
    nrwGal,
    nrwPercent
  };
}

function dmaTableHtml(models) {
  if (!models.length) {
    return `<div class="module-empty">No DMAs found. Create DMAs first.</div>`;
  }

  return `
    <div class="module-table-wrap">
      <table class="table-clean">
        <thead>
          <tr>
            <th>DMA</th>
            <th>Customers</th>
            <th>Reads</th>
            <th>Master Meters</th>
            <th>Master Inflow</th>
            <th>Billed Usage</th>
            <th>NRW</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${models.map((item) => `
            <tr>
              <td>
                <strong>${safe(item.dma.name)}</strong><br />
                <small>${safe(item.dma.code || 'No code')}</small>
              </td>
              <td>${item.customerCount}</td>
              <td>${item.readCount}</td>
              <td>${item.masterMeterCount}</td>
              <td>${formatGallons(item.masterFlowGal)}</td>
              <td>${formatGallons(item.authorizedGal)}</td>
              <td>
                <strong>${formatGallons(item.nrwGal)}</strong><br />
                <small>${formatPercent(item.nrwPercent)}</small>
              </td>
              <td>
                <span class="status-badge ${item.statusClass}">
                  ${safe(item.status)}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function wireEvents() {
  document.getElementById('refresh-nrw-btn')?.addEventListener('click', async () => {
    await refreshNrw();
  });

  document.getElementById('nrw-billing-month')?.addEventListener('change', async () => {
    await refreshNrw();
  });
}

async function refreshNrw() {
  const utility = authState.utility;
  const billingMonth = val('nrw-billing-month') || currentMonth();

  if (!utility?.id) return;

  [dmas, customers, reads, masterMeters] = await Promise.all([
    getDmasByUtility(utility.id),
    getCustomersByUtility(utility.id),
    getMeterReadsByMonth(utility.id, billingMonth),
    getMasterMetersByUtility(utility.id)
  ]);

  const root = document.getElementById('dashboard-module-root');
  if (root) {
    render(root, billingMonth);
    wireEvents();
  }
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
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