import {
  Chart,
  BarController,
  BarElement,
  DoughnutController,
  LineController,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';

import { authState } from '../auth/auth.js';
import { getAnalyticsData } from './analyticsService.js';
import { requireTabAccess } from '../auth/permissions.js';

import { getCustomersByUtility } from '../supabase/customers.js';
import { getMeterReadsByMonth } from '../supabase/meterReads.js';

import { analyzeUtilityUsageTrend, detectCustomerAnomalies } from './trendEngine.js';
import { analyzeDmaTrends } from './dmaAnalytics.js';
import { forecastRevenue } from './revenueForecastEngine.js';
import { buildCustomerConsumptionProfile } from './customerProfileEngine.js';

Chart.register(
  BarController,
  BarElement,
  DoughnutController,
  LineController,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

let chartInstances = [];
let latestCustomers = [];
let latestReads = [];

export async function initAnalyticsUi(rootId = 'dashboard-module-root') {
  requireTabAccess('analytics');

  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  destroyCharts();

  root.innerHTML = `
    <section class="module-page">
      <div class="module-toolbar">
        <div class="module-title-block">
          <h2>Analytics & Forecasting</h2>
          <p>
            Analyze utility consumption trends, customer anomalies, DMA demand trends,
            NRW patterns, and forecast revenue.
          </p>
        </div>

        <div class="module-actions">
          <label>Billing Month
            <input id="analytics-billing-month" type="month" value="${currentMonth()}" />
          </label>

          <button id="load-analytics-btn" class="btn-primary" type="button">
            Load Analytics
          </button>
        </div>
      </div>

      <div class="button-row analytics-tabs">
  <button class="btn-primary analytics-tab-btn" data-section="overview" type="button">
    Overview
  </button>

  <button class="btn-secondary analytics-tab-btn" data-section="anomalies" type="button">
    Customer Anomalies
  </button>

  <button class="btn-secondary analytics-tab-btn" data-section="dma" type="button">
    DMA Trends
  </button>

  <button class="btn-secondary analytics-tab-btn" data-section="forecast" type="button">
    Forecasts
  </button>

  <button class="btn-secondary analytics-tab-btn" data-section="customer-profile" type="button">
  Customer Profiles
</button>
</div>

<div id="analytics-section-overview" class="analytics-section">
  <div id="analytics-summary-root"></div>

  <section class="analytics-grid">
    <div class="card chart-card">
      <h3>Customers by Class</h3>
      <canvas id="customers-class-chart"></canvas>
    </div>

    <div class="card chart-card">
      <h3>Usage by Customer Class</h3>
      <canvas id="usage-class-chart"></canvas>
    </div>

    <div class="card chart-card">
      <h3>Revenue Breakdown</h3>
      <canvas id="revenue-chart"></canvas>
    </div>

    <div class="card chart-card">
      <h3>NRW Trend</h3>
      <canvas id="nrw-trend-chart"></canvas>
    </div>
  </section>
</div>

<div id="analytics-section-anomalies" class="analytics-section" hidden>
  <section class="module-panel" style="margin-top:1rem;">
    <div class="module-panel-header">
      <div>
        <h3 class="module-panel-title">Customer Anomalies</h3>
        <p class="module-panel-subtitle">
          Flags zero usage, sudden drops, spikes, statistical outliers, and possible stuck meters.
        </p>
      </div>
    </div>

    <div id="customer-anomalies-root"></div>
  </section>
</div>

<div id="analytics-section-dma" class="analytics-section" hidden>
  <section class="module-panel" style="margin-top:1rem;">
    <div class="module-panel-header">
      <div>
        <h3 class="module-panel-title">DMA Trend Forecast</h3>
        <p class="module-panel-subtitle">
          Forecasted demand trends by DMA based on meter-read history.
        </p>
      </div>
    </div>

    <div id="dma-trends-root"></div>
  </section>
</div>

<div id="analytics-section-forecast" class="analytics-section" hidden>
  <section class="module-panel" style="margin-top:1rem;">
    <div class="module-panel-header">
      <div>
        <h3 class="module-panel-title">Forecast Summary</h3>
        <p class="module-panel-subtitle">
          Forecasted utility demand and revenue based on available reads.
        </p>
      </div>
    </div>

    <div id="forecast-summary-root"></div>
  </section>
  </div>
  <div id="analytics-section-customer-profile" class="analytics-section" hidden>
  <section class="module-panel" style="margin-top:1rem;">
    <div class="module-panel-header">
      <div>
        <h3 class="module-panel-title">Customer Consumption Profile</h3>
        <p class="module-panel-subtitle">
          Search a customer to review usage trend, forecast, leak risk, meter risk, and revenue impact.
        </p>
      </div>
    </div>

    <div class="form-grid">
      <label>Search Customer
        <input id="customer-profile-search" placeholder="Account, meter, or customer name" />
      </label>
    </div>

    <div class="button-row">
      <button id="load-customer-profile-btn" class="btn-primary" type="button">
        Analyze Customer
      </button>
    </div>

    <div id="customer-profile-root" style="margin-top:1rem;"></div>
  </section>
</div>
    </section>
  `;

  wireAnalyticsTabs();
document
  .getElementById('load-customer-profile-btn')
  ?.addEventListener('click', renderCustomerProfile);

  document
  .getElementById('load-analytics-btn')
  ?.addEventListener('click', loadAnalytics);

await loadAnalytics();
}

async function loadAnalytics() {
  const utility = authState.utility;
  const month = val('analytics-billing-month') || currentMonth();

  if (!utility?.id) return;

  destroyCharts();

  const [data, customers, reads] = await Promise.all([
    getAnalyticsData(utility.id, month),
    getCustomersByUtility(utility.id),
    getMeterReadsByMonth(utility.id, month)
  ]);

  latestCustomers = customers;
  latestReads = reads;

  renderBarChart(
    'customers-class-chart',
    Object.keys(data.customersByClass || {}),
    Object.values(data.customersByClass || {}),
    'Customers'
  );

  renderBarChart(
    'usage-class-chart',
    Object.keys(data.usageByClass || {}),
    Object.values(data.usageByClass || {}),
    'Gallons'
  );

  renderDoughnutChart(
    'revenue-chart',
    ['Water', 'Sewer', 'Fees', 'Taxes', 'Adjustments'],
    [
      data.revenueSummary?.water || 0,
      data.revenueSummary?.sewer || 0,
      data.revenueSummary?.fees || 0,
      data.revenueSummary?.taxes || 0,
      data.revenueSummary?.adjustments || 0
    ]
  );

  renderLineChart(
    'nrw-trend-chart',
    (data.nrwTrend || []).map((item) => item.month),
    (data.nrwTrend || []).map((item) => item.nrwPercent),
    'NRW %'
  );

  const utilityTrend = analyzeUtilityUsageTrend(reads);
  const anomalies = detectCustomerAnomalies(reads);
  const dmaTrends = analyzeDmaTrends(reads, customers);
  const importedRows = window.OFORI_IMPORTED_USAGE_ROWS || [];

const importedTrend = importedRows.length
  ? analyzeUtilityUsageTrend(importedRows)
  : null;

const importedAnomalies = importedRows.length
  ? detectCustomerAnomalies(importedRows)
  : [];
  

  const revenueForecast = forecastRevenue({
    forecastUsage: utilityTrend.forecast_next_period_usage || utilityTrend.forecastUsage || 0,
    ratePerThousandGallons: 6,
    baseCharge: 15,
    accountCount: customers.length
  });

  renderAnalyticsSummary({
  utilityTrend,
  revenueForecast,
  reads,
  customers,
  importedRows,
  importedTrend
});

renderForecastSummary({
  utilityTrend,
  revenueForecast,
  importedTrend,
  importedRows
});

  renderCustomerAnomalies(anomalies);
  renderDmaTrends(dmaTrends);
}

function renderAnalyticsSummary({
  utilityTrend,
  revenueForecast,
  reads,
  customers,
  importedRows = [],
  importedTrend = null
}) {
  const root = document.getElementById('analytics-summary-root');

  if (!root) return;

  root.innerHTML = `
    <div class="module-kpis">
      ${metricCard('Total Customers', customers.length)}
      ${metricCard('Reads Analyzed', reads.length)}
      ${metricCard('Utility Trend', utilityTrend.trend_direction || utilityTrend.trend || 'No data')}
      ${metricCard('Forecast Usage', formatNumber(utilityTrend.forecast_next_period_usage || utilityTrend.forecastUsage || 0))}
      ${metricCard('Forecast Revenue', '$' + formatNumber(revenueForecast.totalForecastRevenue || 0))}
   ${metricCard('Imported Rows', importedRows.length)}
${metricCard(
  'Imported Forecast',
  importedTrend
    ? formatNumber(importedTrend.forecast_next_period_usage || importedTrend.forecastUsage || 0)
    : 'No import'
)}
    </div>
  `;
}

function renderCustomerAnomalies(anomalies = []) {
  const root = document.getElementById('customer-anomalies-root');

  if (!root) return;

  if (!anomalies.length) {
    root.innerHTML = `
      <div class="module-empty">
        No customer anomalies detected for this period.
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="compact-list">
      ${anomalies.slice(0, 15).map((item) => `
        <div class="mini-card">
          <strong>${safe(item.customer_name || item.customer_key || 'Customer')}</strong><br />

          <small>
            Meter: ${safe(item.meter_number || '—')}
            • Period: ${safe(item.latest_period || '—')}
            • Latest Usage: ${formatNumber(item.latest_usage)}
            • Avg: ${formatNumber(item.average_usage)}
            • Risk Score: ${formatNumber(item.risk_score)}
          </small>

          <div style="margin-top:.5rem;">
            ${(item.risk_flags || []).map((flag) => `
              <span class="status-badge status-warning">
                ${safe(flag)}
              </span>
            `).join(' ')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDmaTrends(dmaTrends = []) {
  const root = document.getElementById('dma-trends-root');

  if (!root) return;

  if (!dmaTrends.length) {
    root.innerHTML = `
      <div class="module-empty">
        No DMA trend data available yet.
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="compact-list">
      ${dmaTrends.slice(0, 10).map((dma) => `
        <div class="mini-card">
          <strong>${safe(dma.dma_name || 'DMA')}</strong><br />

          <small>
            Trend: ${safe(dma.trend)}
            • Forecast Usage: ${formatNumber(dma.forecastUsage)}
            • Months: ${dma.months?.length || 0}
          </small>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBarChart(canvasId, labels, values, label) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  chartInstances.push(
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label, data: values }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        resizeDelay: 200
      }
    })
  );
}

function renderDoughnutChart(canvasId, labels, values) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  chartInstances.push(
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    })
  );
}

function renderLineChart(canvasId, labels, values, label) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  chartInstances.push(
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    })
  );
}


function renderForecastSummary({
  utilityTrend,
  revenueForecast,
  importedTrend = null,
  importedRows = []
}) {
  const root = document.getElementById('forecast-summary-root');

  if (!root) return;

  root.innerHTML = `
    <div class="module-kpis">
      ${metricCard(
        'Utility Forecast Usage',
        formatNumber(utilityTrend.forecast_next_period_usage || utilityTrend.forecastUsage || 0)
      )}

      ${metricCard(
        'Utility Trend',
        utilityTrend.trend_direction || utilityTrend.trend || 'No data'
      )}

      ${metricCard(
        'Forecast Revenue',
        '$' + formatNumber(revenueForecast.totalForecastRevenue || 0)
      )}

      ${metricCard(
        'Imported Rows',
        importedRows.length
      )}

      ${metricCard(
        'Imported Forecast',
        importedTrend
          ? formatNumber(importedTrend.forecast_next_period_usage || importedTrend.forecastUsage || 0)
          : 'No import'
      )}
    </div>

    <section class="module-panel" style="margin-top:1rem;">
      <h3 class="module-panel-title">Forecast Interpretation</h3>
      <p>
        Forecasts are based on recent consumption history. Imported AMI, AMR, manual,
        or billing data can improve trend reliability when more periods are uploaded.
      </p>
    </section>
  `;
}

function wireAnalyticsTabs() {
  document.querySelectorAll('.analytics-tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;

      document.querySelectorAll('.analytics-section').forEach((panel) => {
        panel.hidden = panel.id !== `analytics-section-${section}`;
      });

      document.querySelectorAll('.analytics-tab-btn').forEach((btn) => {
        const active = btn.dataset.section === section;
        btn.classList.toggle('btn-primary', active);
        btn.classList.toggle('btn-secondary', !active);
      });
    });
  });
}

function renderCustomerProfile() {
  const root = document.getElementById('customer-profile-root');
  const search = val('customer-profile-search').toLowerCase();

  if (!root) return;

  if (!search) {
    root.innerHTML = `
      <div class="module-empty">
        Enter an account number, meter number, or customer name.
      </div>
    `;
    return;
  }

  const customer = latestCustomers.find((item) =>
    String(item.account_number || '').toLowerCase().includes(search) ||
    String(item.meter_number || '').toLowerCase().includes(search) ||
    String(item.customer_name || '').toLowerCase().includes(search)
  );

  if (!customer) {
    root.innerHTML = `
      <div class="module-empty">
        No matching customer found.
      </div>
    `;
    return;
  }

  const customerReads = latestReads.filter((read) =>
    read.customer_id === customer.id ||
    read.account_number === customer.account_number ||
    read.meter_number === customer.meter_number
  );

  const profile = buildCustomerConsumptionProfile({
    customer,
    reads: customerReads
  });

  root.innerHTML = `
    <div class="module-kpis">
      ${metricCard('Records', profile.records)}
      ${metricCard('Latest Usage', formatNumber(profile.latestUsage))}
      ${metricCard('Average Usage', formatNumber(profile.averageUsage))}
      ${metricCard('Forecast Usage', formatNumber(profile.forecastUsage))}
      ${metricCard('Trend', profile.trend)}
      ${metricCard('Leak Risk', profile.leakRisk)}
      ${metricCard('Meter Risk', profile.meterRisk)}
      ${metricCard('Forecast Revenue', '$' + formatNumber(profile.forecastRevenue))}
    </div>

    <section class="module-panel" style="margin-top:1rem;">
      <h3 class="module-panel-title">
        ${safe(customer.account_number)} — ${safe(customer.customer_name || 'Customer')}
      </h3>

      <p>
        Meter: ${safe(customer.meter_number || '—')}
        • Class: ${safe(customer.customer_class || '—')}
      </p>

      <h4>Recommendations</h4>
      <ul>
        ${profile.recommendations
          .map((item) => `<li>${safe(item)}</li>`)
          .join('')}
      </ul>
    </section>

    <section class="module-panel" style="margin-top:1rem;">
  <h3 class="module-panel-title">Usage Trend</h3>
  <div class="chart-card" style="height:320px;">
    <canvas id="customer-profile-usage-chart"></canvas>
  </div>
</section>

    <section class="module-panel" style="margin-top:1rem;">
      <h3 class="module-panel-title">Usage History</h3>

      <div class="module-table-wrap">
        <table class="table-clean">
          <thead>
            <tr>
              <th>Period</th>
              <th>Usage</th>
            </tr>
          </thead>

          <tbody>
            ${profile.history.map((item) => `
              <tr>
                <td>${safe(item.period)}</td>
                <td>${formatNumber(item.usage)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;

  renderLineChart(
  'customer-profile-usage-chart',
  profile.history.map((item) => item.period),
  profile.history.map((item) => item.usage),
  'Usage'
);
}

function destroyCharts() {
  chartInstances.forEach((chart) => chart.destroy());
  chartInstances = [];
}

function metricCard(label, value) {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${safe(label)}</div>
      <div class="kpi-value">${safe(value)}</div>
    </div>
  `;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
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