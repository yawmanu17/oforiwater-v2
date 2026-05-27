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
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  destroyCharts();

  root.innerHTML = `
    <section class="card section-card">
      <h2>Analytics Dashboard</h2>
      <p>Visualize customers, consumption, revenue, and NRW performance.</p>

      <div class="form-grid">
        <label>Billing Month
          <input id="analytics-billing-month" type="month" value="${currentMonth()}" />
        </label>
      </div>

      <div class="button-row">
        <button id="load-analytics-btn" class="btn-primary" type="button">
          Load Analytics
        </button>
      </div>
    </section>

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
  `;

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

  const data = await getAnalyticsData(utility.id, month);

  renderBarChart(
    'customers-class-chart',
    Object.keys(data.customersByClass),
    Object.values(data.customersByClass),
    'Customers'
  );

  renderBarChart(
    'usage-class-chart',
    Object.keys(data.usageByClass),
    Object.values(data.usageByClass),
    'Gallons'
  );

  renderDoughnutChart(
    'revenue-chart',
    ['Water', 'Sewer', 'Fees', 'Taxes', 'Adjustments'],
    [
      data.revenueSummary.water,
      data.revenueSummary.sewer,
      data.revenueSummary.fees,
      data.revenueSummary.taxes,
      data.revenueSummary.adjustments
    ]
  );

  renderLineChart(
    'nrw-trend-chart',
    data.nrwTrend.map((item) => item.month),
    data.nrwTrend.map((item) => item.nrwPercent),
    'NRW %'
  );
}

function renderBarChart(canvasId, labels, values, label) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  chartInstances.push(
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
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

function destroyCharts() {
  chartInstances.forEach((chart) => chart.destroy());
  chartInstances = [];
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}