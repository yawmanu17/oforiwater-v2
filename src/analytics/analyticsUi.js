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
    </section>
  `;

  wireAnalyticsTabs();

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