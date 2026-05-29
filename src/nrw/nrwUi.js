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

import { calculateNrwMetrics } from './nrwEngine.js';

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
            Analyze NRW, apparent losses, real losses, ILI, CRLI estimates,
            DMA leakage risk, and financial loss exposure.
          </p>
        </div>

        <div class="module-actions">
          <label>Billing Month
            <input id="nrw-billing-month" type="month" value="${safe(billingMonth)}" />
          </label>

          <button id="refresh-nrw-btn" class="btn-primary" type="button">
            Refresh NRW
          </button>
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

      ${nrwCalculatorHtml()}

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

function nrwCalculatorHtml() {
  return `
    <section class="module-panel">
      <div class="module-panel-header">
        <div>
          <h3 class="module-panel-title">NRW / Water Balance Calculator</h3>
          <p class="module-panel-subtitle">
            Calculate NRW, apparent losses, real losses, ILI, CRLI estimate, and loss cost.
          </p>
        </div>
      </div>

      <div class="form-grid">
        <label>Production Volume
          <input id="nrw-production" type="number" step="0.01" />
        </label>

        <label>Purchased Water
          <input id="nrw-purchased-water" type="number" step="0.01" />
        </label>

        <label>Exported Water
          <input id="nrw-exported-water" type="number" step="0.01" />
        </label>

        <label>Billed Metered Consumption
          <input id="nrw-billed-metered" type="number" step="0.01" />
        </label>

        <label>Billed Unmetered Consumption
          <input id="nrw-billed-unmetered" type="number" step="0.01" />
        </label>

        <label>Unbilled Metered Consumption
          <input id="nrw-unbilled-metered" type="number" step="0.01" />
        </label>

        <label>Unbilled Unmetered Consumption
          <input id="nrw-unbilled-unmetered" type="number" step="0.01" />
        </label>

        <label>Unauthorized Consumption
          <input id="nrw-unauthorized-consumption" type="number" step="0.01" />
        </label>

        <label>Customer Meter Inaccuracy
          <input id="nrw-customer-meter-inaccuracy" type="number" step="0.01" />
        </label>

        <label>Data Handling Errors
          <input id="nrw-data-handling-errors" type="number" step="0.01" />
        </label>

        <label>Service Connections
          <input id="nrw-service-connections" type="number" step="1" />
        </label>

        <label>Mains Length Miles
          <input id="nrw-mains-length-miles" type="number" step="0.01" />
        </label>

        <label>Average Pressure PSI
          <input id="nrw-avg-pressure-psi" type="number" step="0.01" />
        </label>

        <label>Variable Production Cost / Unit
          <input id="nrw-variable-production-cost" type="number" step="0.01" />
        </label>

        <label>Retail Unit Cost
          <input id="nrw-retail-unit-cost" type="number" step="0.01" />
        </label>
      </div>

      <div class="button-row">
        <button id="calculate-nrw-btn" class="btn-primary" type="button">
          Calculate NRW Metrics
        </button>
      </div>

      <div id="nrw-calculation-results" style="margin-top:1rem;"></div>
    </section>
  `;
}

function wireEvents() {
  document.getElementById('refresh-nrw-btn')?.addEventListener('click', refreshNrw);

  document.getElementById('nrw-billing-month')?.addEventListener('change', refreshNrw);

  document
    .getElementById('calculate-nrw-btn')
    ?.addEventListener('click', calculateAndRenderNrw);
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

function calculateAndRenderNrw() {
  const metrics = calculateNrwMetrics({
    production: val('nrw-production'),
    purchased_water: val('nrw-purchased-water'),
    exported_water: val('nrw-exported-water'),

    billed_metered: val('nrw-billed-metered'),
    billed_unmetered: val('nrw-billed-unmetered'),
    unbilled_metered: val('nrw-unbilled-metered'),
    unbilled_unmetered: val('nrw-unbilled-unmetered'),

    unauthorized_consumption: val('nrw-unauthorized-consumption'),
    customer_meter_inaccuracy: val('nrw-customer-meter-inaccuracy'),
    data_handling_errors: val('nrw-data-handling-errors'),

    service_connections: val('nrw-service-connections'),
    mains_length_miles: val('nrw-mains-length-miles'),
    avg_pressure_psi: val('nrw-avg-pressure-psi'),

    variable_production_cost: val('nrw-variable-production-cost'),
    retail_unit_cost: val('nrw-retail-unit-cost')
  });

  renderNrwResults(metrics);
}

function renderNrwResults(metrics) {
  const root = document.getElementById('nrw-calculation-results');

  if (!root) return;

  root.innerHTML = `
    <div class="module-kpis">
      ${metricCard('System Input Volume', formatNumber(metrics.systemInputVolume))}
      ${metricCard('Authorized Consumption', formatNumber(metrics.authorizedConsumption))}
      ${metricCard('Revenue Water', formatNumber(metrics.revenueWater))}
      ${metricCard('NRW Volume', formatNumber(metrics.nonRevenueWater))}
      ${metricCard('NRW %', `${formatNumber(metrics.nrwPercent)}%`)}
      ${metricCard('Apparent Losses', formatNumber(metrics.apparentLosses))}
      ${metricCard('Real Losses', formatNumber(metrics.realLosses))}
      ${metricCard('Revenue Water %', `${formatNumber(metrics.revenueWaterPercent)}%`)}
      ${metricCard('Real Loss / Conn / Day', nullableNumber(metrics.realLossPerConnectionPerDay))}
      ${metricCard('Real Loss / Mile / Day', nullableNumber(metrics.realLossPerMilePerDay))}
      ${metricCard('ILI Estimate', nullableNumber(metrics.ili))}
      ${metricCard('CRLI Estimate', nullableNumber(metrics.crli))}
      ${metricCard('Loss Cost', `$${formatNumber(metrics.totalLossCost)}`)}
      ${metricCard('Performance', metrics.performanceBand)}
    </div>

    <section class="module-panel" style="margin-top:1rem;">
      <h3 class="module-panel-title">Interpretation</h3>
      <p>
        NRW is the difference between water entering the system and authorized consumption.
        Apparent losses reflect metering, theft, and data handling issues. Real losses reflect
        leakage, breaks, tank overflows, and physical losses. ILI and CRLI help benchmark leakage
        performance beyond simple NRW percentage.
      </p>
    </section>
  `;
}

function metricCard(label, value) {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${safe(label)}</div>
      <div class="kpi-value">${safe(value)}</div>
    </div>
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

function nullableNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Insufficient data';
  }

  return formatNumber(value);
}

function formatNumber(value) {
  const number = Number(value || 0);

  return number.toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
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