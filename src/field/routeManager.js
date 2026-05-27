import { authState } from '../auth/auth.js';
import { getDmasByUtility } from '../supabase/dmas.js';
import { getCustomersByUtility } from '../supabase/customers.js';
import {
  createRoute,
  getRoutesByUtility,
  addRouteStop,
  addRouteStopsBulk,
  getRouteStops,
  updateRouteStop
} from '../supabase/routes.js';

let dmas = [];
let customers = [];
let routes = [];
let selectedRoute = null;
let routeStops = [];

export async function initRouteManager(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  [dmas, customers, routes] = await Promise.all([
    getDmasByUtility(utility.id),
    getCustomersByUtility(utility.id),
    getRoutesByUtility(utility.id)
  ]);

  selectedRoute = routes[0] || null;
  routeStops = selectedRoute ? await getRouteStops(selectedRoute.id) : [];

  render(root);
  wireEvents();
}

function render(root) {
  const progress = getRouteProgress();

  root.innerHTML = `
    <section class="field-read-shell">
      <div class="module-toolbar field-read-header">
        <div class="module-title-block">
          <h2>Route Manager</h2>
          <p>Create meter reading routes, assign customers, track stop progress, and navigate to meter locations.</p>
        </div>
      </div>

                <div class="module-kpis">
            <div class="kpi-card">
              <div class="kpi-label">Routes</div>
              <div class="kpi-value">${routes.length}</div>
            </div>

            <div class="kpi-card">
              <div class="kpi-label">Customers</div>
              <div class="kpi-value">${customers.length}</div>
            </div>

            <div class="kpi-card">
              <div class="kpi-label">Stops</div>
              <div class="kpi-value">${progress.total}</div>
            </div>

            <div class="kpi-card">
              <div class="kpi-label">Completed</div>
              <div class="kpi-value">${progress.completed}</div>
            </div>

            <div class="kpi-card">
              <div class="kpi-label">Pending</div>
              <div class="kpi-value">${progress.pending}</div>
            </div>

            <div class="kpi-card">
              <div class="kpi-label">Progress</div>
              <div class="kpi-value">${progress.percent.toFixed(0)}%</div>
            </div>
          </div>

      <div class="field-read-layout">
        <section class="field-read-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Create Route</h3>
              <p class="module-panel-subtitle">Build a route by DMA, route code, date, and assigned field reader.</p>
            </div>
          </div>

          <div class="form-grid">
            <label>Route Name
              <input id="route-name" placeholder="North DMA Route" />
            </label>

            <label>Route Code
              <input id="route-code" placeholder="RT-001" />
            </label>

            <label>DMA
              <select id="route-dma-id">
                <option value="">All DMAs</option>
                ${dmas.map((dma) => `
                  <option value="${safe(dma.id)}">${safe(dma.name)}</option>
                `).join('')}
              </select>
            </label>

            <label>Route Date
              <input id="route-date" type="date" value="${todayDate()}" />
            </label>

            <label>Status
              <select id="route-status">
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>

          <label>Notes
            <textarea id="route-notes" rows="3" placeholder="Route notes, access concerns, special instructions..."></textarea>
          </label>

          <div class="field-action-row">
            <button id="create-route-btn" class="btn-primary" type="button">Create Route</button>
          </div>

          <hr style="margin:1rem 0;border:0;border-top:1px solid var(--border);" />

          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Add Customer Stop</h3>
              <p class="module-panel-subtitle">Assign selected customers to the active route.</p>
            </div>
          </div>

          <div class="form-grid">
            <label>Active Route
              <select id="active-route-id">
                <option value="">Select route</option>
                ${routes.map((route) => `
                  <option value="${safe(route.id)}" ${selectedRoute?.id === route.id ? 'selected' : ''}>
                    ${safe(route.route_code || '')} ${safe(route.route_name)}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>Customer
              <select id="route-customer-id">
                <option value="">Select customer</option>
                ${customers.map((customer) => `
                  <option value="${safe(customer.id)}">
                    ${safe(customer.account_number)} — ${safe(customer.customer_name || 'Unnamed')}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>Stop Sequence
              <input id="stop-sequence" type="number" value="${routeStops.length + 1}" />
            </label>
          </div>

          <div class="field-action-row">
            <button id="add-route-stop-btn" class="btn-secondary" type="button">Add Stop</button>
            <button id="auto-add-dma-stops-btn" class="btn-primary" type="button">Auto Add DMA Customers</button>
          </div>
        </section>

        <section class="field-read-panel inspector-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Route Stops</h3>
              <p class="module-panel-subtitle">
                ${selectedRoute ? safe(selectedRoute.route_name) : 'Select or create a route.'}
              </p>
            </div>
          </div>

         <div class="route-progress-card">
            <strong>${progress.percent.toFixed(0)}% Complete</strong>
            ${progressBarHtml(progress.percent)}
            <small>${progress.completed} completed • ${progress.pending} pending • ${progress.total} total</small>
          </div>

          <div id="route-stop-list">
            ${routeStopListHtml()}
          </div>
        </section>
      </div>
    </section>
  `;
}

function routeStopListHtml() {
  if (!selectedRoute) {
    return `<div class="module-empty">No active route selected.</div>`;
  }

  if (!routeStops.length) {
    return `<div class="module-empty">No stops added to this route yet.</div>`;
  }

  return `
    <div class="compact-list">
      ${routeStops.map((stop) => {
        const customer = stop.customers;
        const lat = customer?.meter_lat || customer?.service_lat;
        const lon = customer?.meter_lon || customer?.service_lon;

        return `
          <div class="mini-card">
            <strong>
              #${safe(stop.stop_sequence)}
              ${safe(customer?.account_number || 'No Account')}
              — ${safe(customer?.customer_name || 'Unnamed')}
            </strong><br />

            <span>${safe(customer?.service_address || 'No address')}</span><br />

            <small>
              Meter: ${safe(customer?.meter_number || '—')}
              • Status: ${safe(stop.status || 'pending')}
            </small>

            <div style="margin-top:.5rem;">
              <span class="status-badge ${stop.status === 'completed' ? 'status-ok' : 'status-warn'}">
                ${safe(stop.status || 'pending')}
              </span>
            </div>

            <div class="button-row">
              <button
                class="btn-secondary complete-stop-btn"
                type="button"
                data-stop-id="${safe(stop.id)}"
              >
                Mark Complete
              </button>

              <button
                class="btn-secondary navigate-stop-btn"
                type="button"
                data-lat="${safe(lat || '')}"
                data-lon="${safe(lon || '')}"
              >
                Navigate
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function wireEvents() {
  document.getElementById('create-route-btn')?.addEventListener('click', handleCreateRoute);
  document.getElementById('add-route-stop-btn')?.addEventListener('click', handleAddStop);
  document
  .getElementById('auto-add-dma-stops-btn')
  ?.addEventListener('click', handleAutoAddDmaStops);

  document.getElementById('active-route-id')?.addEventListener('change', async (event) => {
    const routeId = event.target.value;
    selectedRoute = routes.find((route) => route.id === routeId) || null;
    routeStops = selectedRoute ? await getRouteStops(selectedRoute.id) : [];
    refresh();
  });

  document.querySelectorAll('.complete-stop-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateRouteStop(button.dataset.stopId, {
        status: 'completed'
      });
      routeStops = selectedRoute ? await getRouteStops(selectedRoute.id) : [];
      refresh();
    });
  });

  document.querySelectorAll('.navigate-stop-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const lat = button.dataset.lat;
      const lon = button.dataset.lon;

      if (!lat || !lon) {
        alert('No GPS available for this stop.');
        return;
      }

      window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
    });
  });
}


async function handleAutoAddDmaStops() {
  const utility = authState.utility;
  const routeId = val('active-route-id');

  if (!utility?.id || !routeId) {
    alert('Select an active route first.');
    return;
  }

  const route = routes.find((item) => item.id === routeId);

  if (!route) {
    alert('Route not found.');
    return;
  }

  const routeCustomers = route.dma_id
    ? customers.filter((customer) => customer.dma_id === route.dma_id)
    : customers;

  if (!routeCustomers.length) {
    alert('No customers found for this route DMA.');
    return;
  }

  const confirmed = confirm(
    `Add ${routeCustomers.length} customer(s) to this route? Existing stops will be skipped/updated.`
  );

  if (!confirmed) return;

  const stops = routeCustomers.map((customer, index) => ({
    utility_id: utility.id,
    route_id: routeId,
    customer_id: customer.id,
    stop_sequence: index + 1,
    status: 'pending'
  }));

  await addRouteStopsBulk(stops);

  selectedRoute = route;
  routeStops = await getRouteStops(routeId);

  refresh();
}

async function handleCreateRoute() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const payload = {
    utility_id: utility.id,
    dma_id: val('route-dma-id') || null,
    route_name: val('route-name'),
    route_code: val('route-code'),
    route_date: val('route-date') || todayDate(),
    status: val('route-status') || 'planned',
    notes: val('route-notes')
  };

  if (!payload.route_name) {
    alert('Route name is required.');
    return;
  }

  selectedRoute = await createRoute(payload);
  routes = await getRoutesByUtility(utility.id);
  routeStops = [];

  refresh();
}

async function handleAddStop() {
  const utility = authState.utility;
  const routeId = val('active-route-id');
  const customerId = val('route-customer-id');

  if (!utility?.id || !routeId || !customerId) {
    alert('Select route and customer.');
    return;
  }

  await addRouteStop({
    utility_id: utility.id,
    route_id: routeId,
    customer_id: customerId,
    stop_sequence: numberOrOne(val('stop-sequence')),
    status: 'pending'
  });

  selectedRoute = routes.find((route) => route.id === routeId) || selectedRoute;
  routeStops = await getRouteStops(routeId);

  refresh();
}
function getRouteProgress() {
  const total = routeStops.length;
  const completed = routeStops.filter((stop) => stop.status === 'completed').length;
  const pending = Math.max(total - completed, 0);
  const percent = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    completed,
    pending,
    percent
  };
}

function progressBarHtml(percent) {
  return `
    <div class="route-progress-wrap">
      <div class="route-progress-bar" style="width:${Math.min(percent, 100)}%;"></div>
    </div>
  `;
}

function refresh() {
  const root = document.getElementById('dashboard-module-root');
  if (!root) return;

  render(root);
  wireEvents();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function numberOrOne(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
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