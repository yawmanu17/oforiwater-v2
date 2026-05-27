import { authState } from '../auth/auth.js';
import { getCustomersByUtility } from '../supabase/customers.js';
import {
  createMeterCalibration,
  getMeterCalibrationsByUtility
} from '../supabase/meterCalibrations.js';

let customers = [];

export async function initMeterCalibration(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  customers = await getCustomersByUtility(utility.id);

  render(root);
  wireEvents();
  await refreshCalibrations();
}

function render(root) {
  root.innerHTML = `
    <section class="card section-card">
      <h2>Meter Calibration</h2>
      <p>Track meter testing, accuracy, correction factor, and next calibration due date.</p>

      <div class="form-grid">
        <label>Customer / Meter
          <select id="cal-customer-id">
            <option value="">Select customer</option>
            ${customers.map((customer) => `
              <option value="${safe(customer.id)}">
                ${safe(customer.account_number)} — ${safe(customer.meter_number || 'No Meter')}
              </option>
            `).join('')}
          </select>
        </label>

        <label>Meter Number
          <input id="cal-meter-number" placeholder="MTR-001" />
        </label>

        <label>Calibration Date
          <input id="cal-date" type="date" value="${todayDate()}" />
        </label>

        <label>Performed By
          <input id="cal-performed-by" placeholder="Technician name" />
        </label>

        <label>Low Flow, gpm
          <input id="cal-low-flow" type="number" step="0.01" />
        </label>

        <label>Mid Flow, gpm
          <input id="cal-mid-flow" type="number" step="0.01" />
        </label>

        <label>High Flow, gpm
          <input id="cal-high-flow" type="number" step="0.01" />
        </label>

        <label>Low Accuracy %
          <input id="cal-low-accuracy" type="number" step="0.01" />
        </label>

        <label>Mid Accuracy %
          <input id="cal-mid-accuracy" type="number" step="0.01" />
        </label>

        <label>High Accuracy %
          <input id="cal-high-accuracy" type="number" step="0.01" />
        </label>

        <label>Overall Accuracy %
          <input id="cal-overall-accuracy" type="number" step="0.01" />
        </label>

        <label>Correction Factor
          <input id="cal-correction-factor" type="number" step="0.0001" value="1.0" />
        </label>

        <label>Status
          <select id="cal-status">
            <option value="pending">Pending</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="needs_replacement">Needs Replacement</option>
          </select>
        </label>

        <label>Next Due Date
          <input id="cal-next-due-date" type="date" />
        </label>
      </div>

      <label>Notes
        <textarea id="cal-notes" rows="3"></textarea>
      </label>

      <div class="button-row">
        <button id="save-calibration-btn" class="btn-primary" type="button">
          Save Calibration
        </button>
      </div>
    </section>

    <section class="card section-card">
      <h2>Calibration History</h2>
      <div id="calibration-list"></div>
    </section>
  `;
}

function wireEvents() {
  document
    .getElementById('save-calibration-btn')
    ?.addEventListener('click', saveCalibration);

  document
    .getElementById('cal-customer-id')
    ?.addEventListener('change', fillCustomerMeter);
}

function fillCustomerMeter() {
  const customerId = val('cal-customer-id');
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) return;

  setValue('cal-meter-number', customer.meter_number || '');
}

async function saveCalibration() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const customerId = val('cal-customer-id');

  if (!customerId) {
    alert('Select customer/meter.');
    return;
  }

  const payload = {
    utility_id: utility.id,
    customer_id: customerId,
    meter_number: val('cal-meter-number'),
    calibration_date: val('cal-date'),
    performed_by: val('cal-performed-by'),

    test_flow_low_gpm: numberOrNull(val('cal-low-flow')),
    test_flow_mid_gpm: numberOrNull(val('cal-mid-flow')),
    test_flow_high_gpm: numberOrNull(val('cal-high-flow')),

    accuracy_low_percent: numberOrNull(val('cal-low-accuracy')),
    accuracy_mid_percent: numberOrNull(val('cal-mid-accuracy')),
    accuracy_high_percent: numberOrNull(val('cal-high-accuracy')),
    overall_accuracy_percent: numberOrNull(val('cal-overall-accuracy')),

    calibration_status: val('cal-status'),
    correction_factor: numberOrNull(val('cal-correction-factor')) || 1.0,
    notes: val('cal-notes'),
    next_due_date: val('cal-next-due-date') || null
  };

  if (!payload.meter_number) {
    alert('Meter number is required.');
    return;
    
  await createMeterCalibration(payload);
  }


  clearForm();
  await refreshCalibrations();

  alert('Meter calibration saved.');
}

async function refreshCalibrations() {
  const list = document.getElementById('calibration-list');
  const utility = authState.utility;

  if (!list || !utility?.id) return;

  const records = await getMeterCalibrationsByUtility(utility.id);

  if (!records.length) {
    list.innerHTML = '<p>No calibration records yet.</p>';
    return;
  }

  list.innerHTML = records.map((record) => `
    <div class="mini-card">
      <strong>${safe(record.meter_number)} — ${safe(record.calibration_status)}</strong><br />
      <span>
        ${safe(record.customers?.account_number || 'No Account')}
        — ${safe(record.customers?.customer_name || 'Unnamed Customer')}
      </span><br />
      <small>
        Date: ${safe(record.calibration_date)}
        • Overall Accuracy: ${safe(record.overall_accuracy_percent || '—')}%
        • Next Due: ${safe(record.next_due_date || '—')}
      </small>
    </div>
  `).join('');
}

function clearForm() {
  [
    'cal-customer-id',
    'cal-meter-number',
    'cal-performed-by',
    'cal-low-flow',
    'cal-mid-flow',
    'cal-high-flow',
    'cal-low-accuracy',
    'cal-mid-accuracy',
    'cal-high-accuracy',
    'cal-overall-accuracy',
    'cal-notes',
    'cal-next-due-date'
  ].forEach((id) => setValue(id, ''));

  setValue('cal-date', todayDate());
  setValue('cal-correction-factor', '1.0');
  setValue('cal-status', 'pending');
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

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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