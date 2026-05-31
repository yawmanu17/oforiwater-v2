import { authState } from '../auth/auth.js';
import { getCustomersByUtility } from '../supabase/customers.js';
import { completeRouteStopByCustomer } from '../supabase/routes.js';
import {
  saveMeterRead,
  getMeterReadsByMonth,
  getRecentMeterReadsByUtility
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
import { logAuditEvent } from '../audit/logAuditEvent.js';
import { uploadMeterReadPhoto } from '../supabase/storage.js';
import { showSuccess, showWarning, showError } from '../ui/toast.js';


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
  await renderRecentReads();
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
              <option
                value="${safe(customer.id)}"
                ${selectedCustomer?.id === customer.id ? 'selected' : ''}
              >
                ${safe(customer.account_number)}
                — ${safe(customer.customer_name || 'Unnamed')}
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
          <input
            id="field-current-reading"
            class="field-primary-input"
            type="number"
            step="0.01"
            placeholder="Enter current reading"
          />
        </label>

        <label>Usage
          <input id="field-usage-preview" readonly />
        </label>

        <label>Captured GPS
          <input
            id="field-gps-preview"
            readonly
            placeholder="No GPS captured yet"
          />
        </label>

        <label>Meter Photo
          <input
  id="field-meter-photo"
  type="file"
  accept="image/*"
  capture="environment"
/>

<div class="button-row">
  <button
    id="retake-photo-btn"
    class="btn-secondary"
    type="button"
  >
    Retake
  </button>
</div>

<img
  id="meter-photo-preview"
  style="display:none;max-width:250px;border-radius:12px;"
/>
        </label>

        <label>Photo Note
          <input
            id="field-photo-note"
            placeholder="Leak, blocked meter, damaged lid..."
          />
        </label>
      </div>

      <label>Field Notes
        <textarea
          id="field-notes"
          rows="3"
          placeholder="Meter condition, access notes, leak observation, safety issue..."
        ></textarea>
      </label>

      <div class="field-action-row">
        <button id="field-capture-gps-btn" class="btn-secondary" type="button">
          Capture GPS
        </button>

        <button id="field-save-btn" class="btn-secondary" type="button">
          Save
        </button>

        <button id="field-save-next-btn" class="btn-primary" type="button">
          Save & Next
        </button>

        <button id="field-clear-btn" class="btn-secondary" type="button">
          Clear
        </button>

        <button id="field-navigate-btn" class="btn-secondary" type="button">
          Navigate
        </button>
      </div>

      <section class="module-panel" style="margin-top:1rem;">
        <div class="module-panel-header">
          <div>
            <h3 class="module-panel-title">Recent Meter Reads</h3>
            <p class="module-panel-subtitle">
              Latest field reads, exceptions, GPS capture, and uploaded meter photos.
            </p>
          </div>
        </div>

        <div id="recent-meter-reads-list"></div>
      </section>
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
 
  document.getElementById('field-meter-photo')
  ?.addEventListener('change', previewMeterPhoto);

document.getElementById('retake-photo-btn')
  ?.addEventListener('click', retakePhoto);

  document.getElementById('field-capture-gps-btn')
  ?.addEventListener('click', async (event) => {
    setFieldButtonActive(event.currentTarget);
    await captureGps();
  });

document.getElementById('field-save-btn')
  ?.addEventListener('click', async (event) => {
    setFieldButtonActive(event.currentTarget);
    await saveRead(false);
  });

document.getElementById('field-save-next-btn')
  ?.addEventListener('click', async (event) => {
    setFieldButtonActive(event.currentTarget);
    await saveRead(true);
  });

document.getElementById('field-clear-btn')
  ?.addEventListener('click', (event) => {
    setFieldButtonActive(event.currentTarget);
    clearReadFields();
  });

document.getElementById('field-navigate-btn')
  ?.addEventListener('click', (event) => {
    setFieldButtonActive(event.currentTarget);
    navigateToCustomer();
  });

function setFieldButtonActive(activeButton) {
  document
    .querySelectorAll('.field-action-row button')
    .forEach((button) => {
      button.classList.remove('btn-primary');
      button.classList.add('btn-secondary');
    });

  activeButton.classList.remove('btn-secondary');
  activeButton.classList.add('btn-primary');
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

function previewMeterPhoto(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const preview =
    document.getElementById('meter-photo-preview');

  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
}

function retakePhoto() {
  const fileInput =
    document.getElementById('field-meter-photo');

  const preview =
    document.getElementById('meter-photo-preview');

  if (fileInput) fileInput.value = '';

  if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }
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

async function renderRecentReads() {
  const root = document.getElementById('recent-meter-reads-list');
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  const reads = await getRecentMeterReadsByUtility(utility.id, 25);

  if (!reads.length) {
    root.innerHTML = `
      <div class="module-empty">
        No meter reads recorded yet.
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="compact-list">
      ${reads.map((read) => `
        <div class="mini-card">
          <strong>
            ${safe(read.customers?.account_number || 'No Account')}
            — ${safe(read.customers?.customer_name || 'Unnamed Customer')}
          </strong>

          <br />

          <small>
            Meter: ${safe(read.customers?.meter_number || '—')}
            • Read: ${safe(read.current_read || 0)}
            ${safe(read.reading_unit || '')}
            • Usage: ${Number(read.usage_ccf || 0).toFixed(2)} CCF
            • ${safe(read.reading_date || '')}
          </small>

          ${read.exception_code ? `
            <div style="margin-top:.45rem;">
              <span class="status-badge status-bad">
                ${safe(read.exception_code)}
              </span>
            </div>
          ` : ''}

          ${read.gps_lat && read.gps_lon ? `
            <small>
              GPS: ${Number(read.gps_lat).toFixed(6)},
              ${Number(read.gps_lon).toFixed(6)}
              ${read.gps_accuracy_m ? `• ±${Number(read.gps_accuracy_m).toFixed(1)}m` : ''}
            </small>
          ` : ''}

          ${read.photo_note ? `
            <div style="margin-top:.45rem;">
              <small>Photo Note: ${safe(read.photo_note)}</small>
            </div>
          ` : ''}

          ${read.photo_url ? `
            <div class="button-row" style="margin-top:.65rem;">
              <a
                href="${safe(read.photo_url)}"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-secondary"
              >
                View Meter Photo
              </a>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

async function saveRead(moveNext = false) {
  const utility = authState.utility;

  if (!utility?.id || !selectedCustomer?.id) {
    showWarning('Select a customer first.');
    return;
  }

  const previous = numberOrZero(val('field-previous-reading'));
const current = numberOrZero(val('field-current-reading'));
const unit = val('field-unit') || 'CCF';

if (!current && !val('field-exception-code')) {
  showWarning('Enter current reading or select an exception.');
  return;
}

try {
  let photoUrl = null;

  const photoFile = document.getElementById('field-meter-photo')?.files?.[0];

  if (photoFile && navigator.onLine) {
    photoUrl = await uploadMeterReadPhoto({
      utilityId: utility.id,
      customerId: selectedCustomer.id,
      file: photoFile
    });
  }

  const multiplier = Number(selectedCustomer?.meter_multiplier) > 0
    ? Number(selectedCustomer.meter_multiplier)
    : 1;

  const registerFactor = Number(selectedCustomer?.register_factor) > 0
    ? Number(selectedCustomer.register_factor)
    : 1;

  const rawUsage = Math.max(current - previous, 0);
  const adjustedUsage = rawUsage * multiplier * registerFactor;

  const usageCcf =
    unit === 'GAL'
      ? adjustedUsage / GAL_PER_CCF
      : adjustedUsage;

  const usageGal =
    unit === 'GAL'
      ? adjustedUsage
      : adjustedUsage * GAL_PER_CCF;

  const payload = {
    utility_id: utility.id,
    customer_id: selectedCustomer.id,

    account_number: selectedCustomer.account_number || null,
    service_id: selectedCustomer.service_id || null,
    meter_number: selectedCustomer.meter_number || null,

    billing_month: val('field-billing-month') || currentMonth(),
    reading_date: val('field-reading-date') || todayDate(),

    previous_read: previous,
    current_read: current,

    reading_unit: unit,
    usage_ccf: usageCcf,
    usage_gal: usageGal,

    read_type: val('field-read-type') || 'actual',
    exception_code: val('field-exception-code') || null,
    notes: val('field-notes') || null,

    gps_lat: capturedGps?.lat || null,
    gps_lon: capturedGps?.lon || null,
    gps_accuracy_m: capturedGps?.accuracy || null,

    reader_id: authState.user?.id || null,

    photo_url: photoUrl || null,
    photo_note: val('field-photo-note') || null
  };

if (!navigator.onLine) {
  await savePendingRead(payload);

  showWarning('Device is offline. Meter read saved locally and will sync later.');
  return;
}

    const read = await saveMeterRead(payload);

    await completeRouteStopByCustomer({
      utilityId: utility.id,
      customerId: selectedCustomer.id
    });

    await logAuditEvent({
      action: 'meter_read_recorded',
      entityType: 'meter_read',
      entityId: read.id,
      details: {
        customer_id: read.customer_id,
        meter_number: selectedCustomer.meter_number,
        current_reading: read.current_read,
        reading_date: read.reading_date
      }
    });

        if (photoUrl) {
      await logAuditEvent({
        action: 'meter_read_photo_uploaded',
        entityType: 'meter_read',
        entityId: read.id,
        details: {
          customer_id: selectedCustomer.id,
          meter_number: selectedCustomer.meter_number,
          photo_url: photoUrl
        }
      });
    }

    showSuccess('Meter read saved.');

    reads = await getMeterReadsByMonth(utility.id, payload.billing_month);

    await renderRecentReads();

    if (moveNext) {
      goToNextCustomer();
    } else {
      clearReadFields();
      renderRefresh();
    }
  } catch (error) {
    console.error('Meter read save failed:', error);
    showError(error.message || 'Meter read could not be saved.');
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