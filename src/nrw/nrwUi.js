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
import {
  analyzeNrwDataReadiness,
  calculateNormalizedNrwMetrics
} from './nrwMethodEngine.js';
import {
  buildBusinessCase
} from './businessCaseEngine.js';
import { prioritizeDmas } from './dmaPriorityEngine.js';
import { buildWaterLossActionPlan } from './actionPlanEngine.js';


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
  const prioritizedDmas = prioritizeDmas(models, {
  productionCost: 0.003,
  retailRate: 0.006
});

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
          <button id="export-nrw-pdf-btn" class="btn-secondary" type="button">
            Export NRW Report PDF
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
          ${dmaPriorityHtml(prioritizedDmas)}
        </section>
      </div>
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
      <label>Population Served
        <input id="nrw-population-served" type="number" step="1" />
      </label>

      <label>Days in Period
        <input id="nrw-days-in-period" type="number" step="1" value="30" />
      </label>

      <div class="button-row">
      <button id="load-imported-nrw-btn" class="btn-secondary" type="button">
        Load Imported Data
      </button>

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

  document
    .getElementById('load-imported-nrw-btn')
    ?.addEventListener('click', loadImportedNrwData);
    document
  .getElementById('export-nrw-pdf-btn')
  ?.addEventListener('click', exportNrwPdfReport);
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
  const input = {
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
    retail_unit_cost: val('nrw-retail-unit-cost'),

    population_served: val('nrw-population-served'),
    days_in_period: val('nrw-days-in-period')
  };

  const metrics = calculateNrwMetrics(input);

  const normalized = calculateNormalizedNrwMetrics(
    input,
    metrics
  );

  const readiness = analyzeNrwDataReadiness(
    input,
    metrics
  );

  renderNrwResults(
    metrics,
    normalized,
    readiness
  );
}
function renderNrwResults(metrics, normalized, readiness) {
  const root = document.getElementById('nrw-calculation-results');

  if (!root) return;

  const businessCase = buildBusinessCase(metrics);
  const actionPlan = buildWaterLossActionPlan({
  metrics,
  prioritizedDmas: prioritizeDmas(buildDmaNrwModels(), {
    productionCost: 0.003,
    retailRate: 0.006
  }),
  readiness
});

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
      ${metricCard(
        'Real Loss Cost',
        '$' + formatNumber(businessCase.realLossCost)
      )}

      ${metricCard(
        'Revenue Risk',
        '$' + formatNumber(businessCase.apparentLossRevenueRisk)
      )}

      ${metricCard(
        'Annual Impact',
        '$' + formatNumber(businessCase.totalAnnualImpact)
      )}

      ${metricCard(
        'Priority',
        businessCase.priority
      )}

      ${metricCard(
        'Payback',
        businessCase.payback
      )}
      ${metricCard('GPD / Connection', nullableNumber(normalized.gpdPerConnection))}
      ${metricCard('GPD / Person', nullableNumber(normalized.gpdPerPerson))}
      ${metricCard('NRW GPD', nullableNumber(normalized.nrwGpd))}
      ${metricCard('Real Loss GPD', nullableNumber(normalized.realLossGpd))}
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

    <section class="module-panel" style="margin-top:1rem;">
  <h3 class="module-panel-title">Valid Methods From Current Data</h3>

  ${readiness.methods.length ? `
    <div class="compact-list">
      ${readiness.methods.map((method) => `
        <div class="mini-card">
          <strong>${safe(method.name)}</strong><br />
          <small>
            Metric: ${safe(method.metric)}
            • Confidence: ${safe(method.confidence)}
          </small>
          <p>${safe(method.usedFor)}</p>
        </div>
      `).join('')}
    </div>
  ` : `
    <div class="module-empty">
      Not enough data to calculate formal NRW methods yet.
    </div>
  `}
</section>

<section class="module-panel" style="margin-top:1rem;">
  <h3 class="module-panel-title">Missing Data / Improvement Needs</h3>

  ${readiness.missing.length ? `
    <ul>
      ${readiness.missing.map((item) => `<li>${safe(item)}</li>`).join('')}
    </ul>
  ` : `
    <p>All major data fields are available for advanced NRW analysis.</p>
  `}
</section>

<section class="module-panel" style="margin-top:1rem;">
  <h3 class="module-panel-title">Recommended Strategy</h3>

  ${readiness.recommendations.length ? `
    <ul>
      ${readiness.recommendations.map((item) => `<li>${safe(item)}</li>`).join('')}
    </ul>
  ` : `
    <p>NRW indicators are stable based on the provided data.</p>
  `}
</section>
<section class="module-panel" style="margin-top:1rem;">
  <h3 class="module-panel-title">
    Business Case Recommendation
  </h3>

  <ul>
    ${businessCase.strategy
      .map(item => `<li>${safe(item)}</li>`)
      .join('')}
  </ul>
</section>
<section class="module-panel" style="margin-top:1rem;">
  <h3 class="module-panel-title">
    Water Loss Action Plan
  </h3>

  ${actionPlan.map((plan) => `
    <div class="mini-card">
      <strong>${safe(plan.title)}</strong>

      <div style="margin:.5rem 0;">
        <span class="status-badge">
          ${safe(plan.priority)}
        </span>
      </div>

      <p>${safe(plan.summary)}</p>

      <ul>
        ${plan.steps
          .map(step => `<li>${safe(step)}</li>`)
          .join('')}
      </ul>
    </div>
  `).join('')}
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

function dmaPriorityHtml(items) {
  if (!items.length) {
    return '';
  }

  return `
    <section class="module-panel" style="margin-top:1rem;">
      <div class="module-panel-header">
        <div>
          <h3 class="module-panel-title">DMA Prioritization</h3>
          <p class="module-panel-subtitle">
            Ranked by NRW percentage, NRW volume, and estimated annual loss exposure.
          </p>
        </div>
      </div>

      <div class="compact-list">
        ${items.slice(0, 5).map((item, index) => `
          <div class="mini-card">
            <strong>
              #${index + 1} ${safe(item.dma.name)}
            </strong><br />

            <small>
              NRW: ${formatPercent(item.nrwPercent)}
              • Volume: ${formatGallons(item.nrwGal)}
              • Annual Loss: $${formatNumber(item.annualLossCost)}
            </small>

            <div style="margin-top:.5rem;">
              <span class="status-badge ${priorityClass(item.priorityLevel)}">
                ${safe(item.priorityLevel)}
              </span>
            </div>

            <p style="margin-top:.5rem;">
              ${safe(item.recommendedAction)}
            </p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function exportNrwPdfReport() {
  const { jsPDF } = window.jspdf;

  const models = buildDmaNrwModels();
  const totals = summarizeModels(models);

  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('OFORI Water - NRW Analytics Report', 14, 18);

  doc.setFontSize(10);
  doc.text(`Utility: ${authState.utility?.name || 'Utility'}`, 14, 26);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

  doc.autoTable({
    startY: 42,
    head: [['Metric', 'Value']],
    body: [
      ['Master Inflow', formatGallons(totals.masterFlowGal)],
      ['Billed Usage', formatGallons(totals.billedUsageGal)],
      ['NRW Volume', formatGallons(totals.nrwGal)],
      ['NRW %', formatPercent(totals.nrwPercent)]
    ]
  });

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 10,
    head: [[
      'DMA',
      'Customers',
      'Reads',
      'Master Inflow',
      'Billed Usage',
      'NRW',
      'NRW %',
      'Status'
    ]],
    body: models.map((item) => [
      item.dma.name || '',
      item.customerCount,
      item.readCount,
      formatGallons(item.masterFlowGal),
      formatGallons(item.authorizedGal),
      formatGallons(item.nrwGal),
      formatPercent(item.nrwPercent),
      item.status
    ])
  });

  doc.save(`OFORI-NRW-Report-${currentMonth()}.pdf`);
}
function priorityClass(level) {
  if (level === 'Critical') return 'status-bad';
  if (level === 'High') return 'status-warning';
  if (level === 'Moderate') return 'status-watch';

  return 'status-ok';
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

function loadImportedNrwData() {
  setValue(
    'nrw-production',
    window.OFORI_NRW_IMPORTED_PRODUCTION || ''
  );

  setValue(
    'nrw-purchased-water',
    window.OFORI_NRW_IMPORTED_PURCHASED || ''
  );

  setValue(
    'nrw-exported-water',
    window.OFORI_NRW_IMPORTED_EXPORTED || ''
  );

  setValue(
    'nrw-billed-metered',
    window.OFORI_NRW_IMPORTED_BILLED_USAGE || ''
  );

  calculateAndRenderNrw();
}

function setValue(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.value = value;
  }
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