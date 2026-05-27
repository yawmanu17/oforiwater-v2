import { authState } from '../auth/auth.js';
import { getCustomersByUtility } from '../supabase/customers.js';
import {
  createBillingAdjustment,
  getAdjustmentsByUtility
} from '../supabase/adjustments.js';

let customers = [];

export async function initAdjustmentsUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  customers = await getCustomersByUtility(utility.id);

  render(root);
  wireEvents();
  await refreshAdjustments();
}

function render(root) {
  root.innerHTML = `
    <section class="card section-card">
      <h2>Billing Adjustments</h2>
      <p>Add credits, penalties, corrections, leak adjustments, and manual account changes.</p>

      <div class="form-grid">
        <label>Customer
          <select id="adjustment-customer-id">
            <option value="">Select customer</option>
            ${customers.map((customer) => `
              <option value="${safe(customer.id)}">
                ${safe(customer.account_number)} — ${safe(customer.customer_name || 'Unnamed')}
              </option>
            `).join('')}
          </select>
        </label>

        <label>Billing Month
          <input id="adjustment-billing-month" type="month" value="${currentMonth()}" />
        </label>

        <label>Adjustment Type
          <select id="adjustment-type">
            <option value="Credit">Credit</option>
            <option value="Penalty">Penalty</option>
            <option value="Leak Adjustment">Leak Adjustment</option>
            <option value="Billing Correction">Billing Correction</option>
            <option value="Manual Fee">Manual Fee</option>
          </select>
        </label>

        <label>Amount
          <input id="adjustment-amount" type="number" step="0.01" value="0" />
        </label>
      </div>

      <label>Description
        <textarea id="adjustment-description" rows="3" placeholder="Reason for adjustment"></textarea>
      </label>

      <div class="button-row">
        <button id="save-adjustment-btn" class="btn-primary" type="button">
          Save Adjustment
        </button>
      </div>
    </section>

    <section class="card section-card">
      <h2>Adjustment History</h2>
      <div id="adjustment-list"></div>
    </section>
  `;
}

function wireEvents() {
  document
    .getElementById('save-adjustment-btn')
    ?.addEventListener('click', saveAdjustment);
}

async function saveAdjustment() {
  const utility = authState.utility;
  const profile = authState.profile;

  if (!utility?.id || !profile?.id) return;

  const customerId = val('adjustment-customer-id');

  if (!customerId) {
    alert('Select a customer.');
    return;
  }

  const payload = {
    utility_id: utility.id,
    customer_id: customerId,
    billing_month: val('adjustment-billing-month'),
    adjustment_type: val('adjustment-type'),
    description: val('adjustment-description'),
    amount: numberOrZero(val('adjustment-amount')),
    approved_by: profile.id
  };

  if (!payload.billing_month) {
    alert('Billing month is required.');
    return;
    await createBillingAdjustment(payload);
  }

  

  clearForm();
  await refreshAdjustments();

  alert('Adjustment saved.');
}

async function refreshAdjustments() {
  const list = document.getElementById('adjustment-list');
  const utility = authState.utility;

  if (!list || !utility?.id) return;

  const adjustments = await getAdjustmentsByUtility(utility.id);

  if (!adjustments.length) {
    list.innerHTML = '<p>No adjustments recorded yet.</p>';
    return;
  }

  list.innerHTML = adjustments.map((item) => `
    <div class="mini-card">
      <strong>${safe(item.adjustment_type)} — ${formatMoney(item.amount)}</strong><br />
      <span>
        ${safe(item.customers?.account_number || 'No Account')}
        — ${safe(item.customers?.customer_name || 'Unnamed Customer')}
      </span><br />
      <small>
        Month: ${safe(item.billing_month)}
        • Approved by: ${safe(item.profiles?.full_name || item.profiles?.email || '—')}
      </small>
      <p>${safe(item.description || '')}</p>
    </div>
  `).join('');
}

function clearForm() {
  setValue('adjustment-customer-id', '');
  setValue('adjustment-amount', '0');
  setValue('adjustment-description', '');
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
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

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
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