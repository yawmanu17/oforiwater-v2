import { authState } from '../auth/auth.js';
import { getCustomersByUtility } from '../supabase/customers.js';
import { completeRouteStopByCustomer } from '../supabase/routes.js';
import {
  saveMeterRead,
  getMeterReadsByMonth
} from '../supabase/meterReads.js';
import { getCurrentGpsPosition } from '../gis/geocode.js';
import {
  modulePage,
  moduleToolbar,
  modulePanel,
  moduleKpis,
  emptyState,
  safe
} from '../ui/moduleLayout.js';

const GAL_PER_CCF = 748;

let customers = [];
let reads = [];
let selectedCustomer = null;
let currentIndex = 0;
let capturedGps = null;

export async function initFieldMeterReads(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  const billingMonth = currentMonth();

  [customers, reads] = await Promise.all([
    getCustomersByUtility(utility.id),
    getMeterReadsByMonth(utility.id, billingMonth)
  ]);

  selectedCustomer = customers[0] || null;
  currentIndex = selectedCustomer ? 0 : -1;
  capturedGps = null;

  render(root);
  wireEvents();
  updateCustomerSnapshot();
  updateUsagePreview();
}

function render(root) {
  const completed = reads.length;
  const exceptions = reads.filter((read) => read.exception_code).length;
  const remaining = Math.max(customers.length - completed, 0);

  root.innerHTML = modulePage({
    header: moduleToolbar({
      title: 'Field Meter Reads',
      description:
        'Capture monthly readings, GPS verification, exceptions, and field notes for billing, NRW, and route operations.'
    }),

    kpis: moduleKpis([
      { label: 'Customers', value: customers.length },
      { label: 'Completed Reads', value: completed },
      { label: 'Remaining', value: remaining },
      { label: 'Exceptions', value: exceptions }
    ]),

    body: `
      <div class="module-workspace wide-main">
        ${modulePanel({
          title: 'Meter Reading Entry',
          subtitle: 'Designed for field staff: large input, quick exception capture, GPS, and Save & Next.',
          body: readingFormHtml()
        })}

        <div class="module-page">
          ${modulePanel({
            title: 'Current Stop',
            subtitle: 'Selected customer and meter location details.',
            className: 'inspector-panel',
            body: `<div id="field-current-stop">${currentStopHtml()}</div>`
          })}

          ${modulePanel({
            title: 'Recent Reading History',
            subtitle: 'Saved reads for this billing month.',
            body: `<div id="field-history">${historyHtml()}</div>`
          })}
        </div>
      </div>
    `
  });
}

function readingFormHtml() {
  return `
    <div class="field-panel">
      <div class="form-grid">
        <label>Billing Month
          <input id="field-billing-month" type="month" value="${currentMonth()}" />
        </label>

        <label>Reading Date
          <input id="field-reading-date" type="date" value="${todayDate()}" />
        </label>

        <label>Customer
          <select id="field-customer">
            ${customers.map((customer) => `
              <option value="${safe(customer.id)}" ${selectedCustomer?.id === customer.id ? 'selected' : ''}>
                ${safe(customer.account_number)} — ${safe(customer.customer_name || 'Unnamed')}
              </option>
            `).join('')}
          </select>
        </label>

        <label>Reading Unit
          <select id="field-unit">
            <option value="CCF">CCF</option>
            <option value="GAL">Gallons</option>
          </select>
        </label>

        <label>Read Type
          <select id="field-read-type">
            <option value="actual">Actual</option>
            <option value="estimated">Estimated</option>
            <option value="reread">Re-read Required</option>
          </select>
        </label>

        <label>Exception Code
          <select id="field-exception-code">
            <option value="">No exception</option>
            <option value="NO_ACCESS">No access</option>
            <option value="LOCKED_GATE">Locked gate</option>
            <option value="DOG">Dog / safety issue</option>
            <option value="BROKEN_METER">Broken meter</option>
            <option value="LEAK_OBSERVED">Leak observed</option>
            <option value="VACANT">Vacant property</option>
          </select>
        </label>
      </div>

      <div class="form-grid">
        <label>Previous Reading
          <input id="field-previous-reading" type="number" step="0.01" />
        </label>

        <label>Current Reading
          <input id="field-current-reading" class="field-primary-input" type="number" step="0.01" placeholder="Enter current reading" />
        </label>

        <label>Usage
          <input id="field-usage-preview" readonly />
        </label>

        <label>Captured GPS
          <input id="field-gps-preview" readonly placeholder="No GPS captured yet" />
        </label>
      </div>

      <label>Field Notes
        <textarea id="field-notes" rows="3" placeholder="Meter condition, access notes, leak observation, safety issue..."></textarea>
      </label>

      <div class="field-action-row">
        <button id="field-capture-gps-btn" class="btn-secondary" type="button">Capture GPS</button>
        <button id="field-save-btn" class="btn-secondary" type="button">Save</button>
        <button id="field-save-next-btn" class="btn-primary" type="button">Save & Next</button>
        <button id="field-clear-btn" class="btn-secondary" type="button">Clear</button>
        <button id="field-navigate-btn" class="btn-secondary" type="button">Navigate</button>
      </div>
    </div>
  `;
}

function currentStopHtml() {
  if (!selectedCustomer) {
    return emptyState('No customers available for meter reading.');
  }

  const lat = selectedCustomer.meter_lat || selectedCustomer.service_lat;
  const lon = selectedCustomer.meter_lon || selectedCustomer.service_lon;

  return `
    <div class="mini-card">
      <strong>${safe(selectedCustomer.account_number)} — ${safe(selectedCustomer.customer_name || 'Unnamed')}</strong><br />
      <span>${safe(selectedCustomer.service_address || 'No service address')}</span><br />
      <small>
        Meter: ${safe(selectedCustomer.meter_number || '—')}
        • Access: ${safe(selectedCustomer.meter_access_type || '—')}
      </small>

      <div style="margin-top:.6rem;">
        <span class="status-badge ${lat && lon ? 'status-ok' : 'status-warn'}">
          ${lat && lon ? 'GPS Available' : 'Needs GPS'}
        </span>
        <span class="status-badge status-ok">
          Stop ${currentIndex + 1} of ${customers.length}
        </span>
      </div>
    </div>
  `;
}

function historyHtml() {
  if (!reads.length) {
    return emptyState('No readings saved for this month yet.');
  }

  return `
    <div class="compact-list">
      ${reads.slice(0, 10).map((read) => `
        <div class="mini-card">
          <strong>${safe(read.customers?.account_number || 'Account')} — ${safe(read.read_type || 'actual')}</strong><br />
          <small>
            Previous: ${safe(read.previous_read ?? '—')}
            • Current: ${safe(read.current_read ?? '—')}
            • Usage: ${safe(read.usage_ccf ?? '—')} CCF
          </small><br />
          ${
            read.exception_code
              ? `<span class="status-badge status-warn">${safe(read.exception_code)}</span>`
              : `<span class="status-badge status-ok">Saved</span>`
          }
        </div>
      `).join('')}
    </div>
  `;
}

function wireEvents() {
  document.getElementById('field-customer')?.addEventListener('change', handleCustomerChange);
  document.getElementById('field-current-reading')?.addEventListener('input', updateUsagePreview);
  document.getElementById('field-previous-reading')?.addEventListener('input', updateUsagePreview);
  document.getElementById('field-unit')?.addEventListener('change', updateUsagePreview);

  document.getElementById('field-capture-gps-btn')?.addEventListener('click', captureGps);
  document.getElementById('field-save-btn')?.addEventListener('click', () => saveRead(false));
  document.getElementById('field-save-next-btn')?.addEventListener('click', () => saveRead(true));
  document.getElementById('field-clear-btn')?.addEventListener('click', clearReadFields);
  document.getElementById('field-navigate-btn')?.addEventListener('click', navigateToCustomer);
}

function handleCustomerChange() {
  const customerId = val('field-customer');
  const index = customers.findIndex((item) => item.id === customerId);

  currentIndex = index >= 0 ? index : 0;
  selectedCustomer = customers[currentIndex] || null;
  capturedGps = null;

  updateCustomerSnapshot();
  loadPreviousRead();
  updateUsagePreview();
}

function updateCustomerSnapshot() {
  const stop = document.getElementById('field-current-stop');
  if (stop) stop.innerHTML = currentStopHtml();

  if (selectedCustomer) {
    const customerSelect = document.getElementById('field-customer');
    if (customerSelect) customerSelect.value = selectedCustomer.id;
    loadPreviousRead();
  }
}

function loadPreviousRead() {
  if (!selectedCustomer) return;

  const customerReads = reads.filter((read) => read.customer_id === selectedCustomer.id);
  const latest = customerReads[0];

  setValue('field-previous-reading', latest?.current_read ?? '');
}

function updateUsagePreview() {
  const previous = numberOrZero(val('field-previous-reading'));
  const current = numberOrZero(val('field-current-reading'));
  const unit = val('field-unit') || 'CCF';

  const usage = Math.max(current - previous, 0);
  const usageCcf = unit === 'GAL' ? usage / GAL_PER_CCF : usage;
  const usageGal = unit === 'GAL' ? usage : usage * GAL_PER_CCF;

  setValue(
    'field-usage-preview',
    `${usageCcf.toFixed(2)} CCF / ${Math.round(usageGal).toLocaleString()} gal`
  );
}

async function captureGps() {
  try {
    const gps = await getCurrentGpsPosition();

    capturedGps = {
      lat: gps.lat,
      lon: gps.lon,
      accuracy: gps.accuracy
    };

    setValue(
      'field-gps-preview',
      `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} ±${Math.round(gps.accuracy)}m`
    );

    alert('GPS captured.');
  } catch (error) {
    alert(error.message || 'Unable to capture GPS.');
  }
}

async function saveRead(moveNext = false) {
  const utility = authState.utility;

  if (!utility?.id || !selectedCustomer?.id) {
    alert('Select a customer first.');
    return;
  }

  const previous = numberOrZero(val('field-previous-reading'));
  const current = numberOrZero(val('field-current-reading'));
  const unit = val('field-unit') || 'CCF';

  if (!current && !val('field-exception-code')) {
    alert('Enter current reading or select an exception.');
    return;
  }

  const rawUsage = Math.max(current - previous, 0);
  const usageCcf = unit === 'GAL' ? rawUsage / GAL_PER_CCF : rawUsage;
  const usageGal = unit === 'GAL' ? rawUsage : rawUsage * GAL_PER_CCF;

  const payload = {
    utility_id: utility.id,
    customer_id: selectedCustomer.id,
    billing_month: val('field-billing-month') || currentMonth(),
    reading_date: val('field-reading-date') || todayDate(),
    previous_read: previous,
    current_read: current,
    reading_unit: unit,
    usage_ccf: usageCcf,
    usage_gal: usageGal,
    read_type: val('field-read-type') || 'actual',
    exception_code: val('field-exception-code') || null,
    notes: val('field-notes'),
    gps_lat: capturedGps?.lat || null,
    gps_lon: capturedGps?.lon || null,
    gps_accuracy_m: capturedGps?.accuracy || null,
    reader_id: authState.user?.id || null
  };

  if (!navigator.onLine) {
  await savePendingRead(payload);
  alert('Device is offline. Meter read saved locally and will sync later.');
} else {
  await saveMeterRead(payload);

  await completeRouteStopByCustomer({
    utilityId: utility.id,
    customerId: customer.id
  });

  alert('Meter read saved.');
}

await logAuditEvent({
  action: 'meter_read_recorded',
  entityType: 'meter_read',
  entityId: read.id,
  details: {
    customer_id: read.customer_id,
    reading: read.current_reading
  }
});

  reads = await getMeterReadsByMonth(utility.id, payload.billing_month);

  if (moveNext) {
    goToNextCustomer();
  } else {
    clearReadFields();
    renderRefresh();
  }
}

function goToNextCustomer() {
  if (!customers.length) return;

  currentIndex = Math.min(currentIndex + 1, customers.length - 1);
  selectedCustomer = customers[currentIndex];
  capturedGps = null;

  renderRefresh();
}

function renderRefresh() {
  const root = document.getElementById('dashboard-module-root');
  if (root) {
    render(root);
    wireEvents();
    updateCustomerSnapshot();
    updateUsagePreview();
  }
}

function clearReadFields() {
  setValue('field-current-reading', '');
  setValue('field-exception-code', '');
  setValue('field-notes', '');
  setValue('field-gps-preview', '');
  capturedGps = null;
  updateUsagePreview();
}

function navigateToCustomer() {
  if (!selectedCustomer) return;

  const lat = selectedCustomer.meter_lat || selectedCustomer.service_lat;
  const lon = selectedCustomer.meter_lon || selectedCustomer.service_lon;

  if (!lat || !lon) {
    alert('No GPS location available for this customer.');
    return;
  }

  window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function calculateBilling({
  usageCcf = 0,
  mode = 'tiered',
  config = {}
}) {
  const usage = Number(usageCcf || 0);
  const fixed = Number(config.fixed_charge || 0);
  const sewer = Number(config.sewer_charge || 0);
  const taxRate = Number(config.tax_percent || 0) / 100;

  let water = 0;

  if (mode === 'flat') {
    water = Number(config.flat_rate || 0);
  }

  if (mode === 'uniform') {
    water = usage * Number(config.usage_rate || 0);
  }

  if (mode === 'tiered') {
    water = calculateTieredCharge(usage, config.tiers || []);
  }

  if (mode === 'decreasing_block') {
    water = calculateTieredCharge(usage, config.tiers || []);
  }

  if (mode === 'base_plus_usage') {
    water = fixed + usage * Number(config.usage_rate || 0);
  }

  if (mode === 'minimum_bill') {
    const usageCharge = usage * Number(config.usage_rate || 0);
    water = Math.max(Number(config.minimum_bill || 0), usageCharge);
  }

  if (mode === 'seasonal') {
    const rate = config.season === 'summer'
      ? Number(config.summer_rate || 0)
      : Number(config.winter_rate || 0);

    water = usage * rate;
  }

  if (mode === 'drought_surcharge') {
    const base = usage * Number(config.usage_rate || 0);
    const threshold = Number(config.surcharge_threshold_ccf || 0);
    const surchargeRate = Number(config.surcharge_rate || 0);
    const excess = Math.max(usage - threshold, 0);

    water = base + excess * surchargeRate;
  }

  if (mode === 'budget_rate') {
    const budget = Number(config.monthly_budget_ccf || 0);
    const insideRate = Number(config.inside_budget_rate || 0);
    const excessRate = Number(config.excess_budget_rate || 0);

    water =
      Math.min(usage, budget) * insideRate +
      Math.max(usage - budget, 0) * excessRate;
  }

  if (mode === 'ny_style') {
    water =
      Number(config.fixed_service_charge || 0) +
      Number(config.frontage_charge || 0) +
      usage * Number(config.usage_rate || 0);
  }

  const subtotal = water + sewer;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return {
    water,
    sewer,
    tax,
    total
  };
}