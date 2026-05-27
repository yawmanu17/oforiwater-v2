import { authState } from '../auth/auth.js';
import { getCustomersByUtility } from '../supabase/customers.js';
import {
  createBillingProfile,
  getBillingProfilesByUtility
} from '../supabase/billingProfiles.js';
import { getMeterReadsByMonth } from '../supabase/meterReads.js';
import {
  createBillingReceipt,
  getReceiptsByUtility
} from '../supabase/receipts.js';
import { calculateBill } from './billingEngine.js';
import { downloadReceiptPdf } from './receiptEngine.js';

let billingProfiles = [];
let customers = [];

export async function initBillingUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  [billingProfiles, customers] = await Promise.all([
    getBillingProfilesByUtility(utility.id),
    getCustomersByUtility(utility.id)
  ]);

  render(root);
  wireEvents();
  updateBillingModeFields();
  await refreshReceipts();
}

function render(root) {
  root.innerHTML = `
    <section class="module-page">
      <div class="module-toolbar">
        <div class="module-title-block">
          <div class="module-eyebrow">Billing & Revenue</div>
          <h2>Billing Configuration</h2>
          <p>Create billing profiles, calculate bills from meter reads, and generate receipts.</p>
        </div>
      </div>

      <div class="module-workspace">
        <section class="module-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Billing Profile Setup</h3>
              <p class="module-panel-subtitle">Choose a billing method and enter the required rate inputs.</p>
            </div>
          </div>

          <div class="form-grid">
            <label>Profile Name
              <input id="billing-profile-name" placeholder="Residential Standard" />
            </label>

            <label>Customer Class
              <select id="billing-customer-class">
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Municipal">Municipal</option>
              </select>
            </label>

            <label>Billing Mode
              <select id="billing-mode">
                <option value="flat">Flat Rate</option>
                <option value="uniform">Uniform Usage Rate</option>
                <option value="tiered">Tiered / Increasing Block</option>
                <option value="decreasing_block">Decreasing Block</option>
                <option value="base_plus_usage">Base Charge + Usage</option>
                <option value="minimum_bill">Minimum Bill</option>
                <option value="seasonal">Seasonal Rate</option>
                <option value="drought_surcharge">Drought / Conservation Surcharge</option>
                <option value="budget_rate">California-style Budget Rate</option>
                <option value="ny_style">NY-style Fixed + Metered</option>
              </select>
            </label>

            <label>Reading Unit
              <select id="billing-reading-unit">
                <option value="CCF">CCF</option>
                <option value="Gallons">Gallons</option>
                <option value="kGal">kGal</option>
              </select>
            </label>

            <label>Currency Symbol
              <input id="currency-symbol" value="$" />
            </label>

            <label>Utility Tax %
              <input id="utility-tax-percent" type="number" step="0.01" value="0" />
            </label>
          </div>

          <div id="billing-mode-fields"></div>

          <div class="button-row">
            <button id="save-billing-profile-btn" class="btn-primary" type="button">
              Save Billing Profile
            </button>
          </div>
        </section>

        <section class="module-panel inspector-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Generate Receipts</h3>
              <p class="module-panel-subtitle">Create customer bills from saved meter reads.</p>
            </div>
          </div>

          <div class="form-grid">
            <label>Billing Month
              <input id="receipt-billing-month" type="month" value="${currentMonth()}" />
            </label>

            <label>Billing Profile
              <select id="receipt-billing-profile-id">
                <option value="">Select profile</option>
                ${billingProfiles.map((profile) => `
                  <option value="${safe(profile.id)}">${safe(profile.name)}</option>
                `).join('')}
              </select>
            </label>
          </div>

          <button id="generate-receipts-btn" class="btn-primary" type="button">
            Generate Receipts from Meter Reads
          </button>
        </section>
      </div>

      <section class="module-panel">
        <div class="module-panel-header">
          <div>
            <h3 class="module-panel-title">Receipt List</h3>
            <p class="module-panel-subtitle">Generated billing receipts and downloadable PDFs.</p>
          </div>
        </div>

        <div id="receipt-list"></div>
      </section>
    </section>
  `;
}

function wireEvents() {
  document.getElementById('billing-mode')?.addEventListener('change', updateBillingModeFields);
  document.getElementById('save-billing-profile-btn')?.addEventListener('click', saveBillingProfile);
  document.getElementById('generate-receipts-btn')?.addEventListener('click', generateReceipts);
}

function updateBillingModeFields() {
  const mode = val('billing-mode') || 'flat';
  const root = document.getElementById('billing-mode-fields');
  if (!root) return;

  if (mode === 'flat') {
    root.innerHTML = `
      <div class="module-panel" style="box-shadow:none;margin-top:.75rem;">
        <h3 class="module-panel-title">Flat Rate</h3>
        <div class="form-grid">
          <label>Flat Water Charge
            <input id="fixed-water-charge" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Fixed Charge
            <input id="sewer-fixed-charge" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Volumetric Rate
            <input id="sewer-volumetric-rate" type="number" step="0.01" value="0" />
          </label>
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'uniform') {
    root.innerHTML = `
      <div class="module-panel" style="box-shadow:none;margin-top:.75rem;">
        <h3 class="module-panel-title">Uniform Usage Rate</h3>
        <div class="form-grid">
          <label>Water Rate ($/CCF)
            <input id="usage-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Fixed Charge
            <input id="sewer-fixed-charge" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Volumetric Rate
            <input id="sewer-volumetric-rate" type="number" step="0.01" value="0" />
          </label>
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'tiered' || mode === 'decreasing_block') {
    root.innerHTML = `
      <div class="module-panel" style="box-shadow:none;margin-top:.75rem;">
        <h3 class="module-panel-title">
          ${mode === 'tiered' ? 'Tiered / Increasing Block Rates' : 'Decreasing Block Rates'}
        </h3>
        <p class="module-panel-subtitle">Leave the final “Usage To” blank for unlimited usage.</p>

        <div class="module-table-wrap">
          <table class="table-clean">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Usage From</th>
                <th>Usage To</th>
                <th>Rate ($/CCF)</th>
              </tr>
            </thead>
            <tbody>
              ${[1, 2, 3, 4].map((tier, index) => `
                <tr>
                  <td>${tier}</td>
                  <td><input id="tier-from-${index}" type="number" step="0.01" value="${index === 0 ? 0 : ''}" /></td>
                  <td><input id="tier-to-${index}" type="number" step="0.01" /></td>
                  <td><input id="tier-rate-${index}" type="number" step="0.01" /></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="form-grid">
          <label>Sewer Fixed Charge
            <input id="sewer-fixed-charge" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Volumetric Rate
            <input id="sewer-volumetric-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Minimum Bill
            <input id="minimum-bill" type="number" step="0.01" value="0" />
          </label>
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'base_plus_usage') {
    root.innerHTML = `
      <div class="module-panel" style="box-shadow:none;margin-top:.75rem;">
        <h3 class="module-panel-title">Base Charge + Usage</h3>
        <div class="form-grid">
          <label>Base Water Charge
            <input id="fixed-water-charge" type="number" step="0.01" value="0" />
          </label>
          <label>Usage Rate ($/CCF)
            <input id="usage-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Fixed Charge
            <input id="sewer-fixed-charge" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Volumetric Rate
            <input id="sewer-volumetric-rate" type="number" step="0.01" value="0" />
          </label>
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'minimum_bill') {
    root.innerHTML = `
      <div class="module-panel" style="box-shadow:none;margin-top:.75rem;">
        <h3 class="module-panel-title">Minimum Bill</h3>
        <div class="form-grid">
          <label>Minimum Bill
            <input id="minimum-bill" type="number" step="0.01" value="0" />
          </label>
          <label>Usage Rate ($/CCF)
            <input id="usage-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Fixed Charge
            <input id="sewer-fixed-charge" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Volumetric Rate
            <input id="sewer-volumetric-rate" type="number" step="0.01" value="0" />
          </label>
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'seasonal') {
    root.innerHTML = `
      <div class="module-panel" style="box-shadow:none;margin-top:.75rem;">
        <h3 class="module-panel-title">Seasonal Rate</h3>
        <div class="form-grid">
          <label>Season
            <select id="season">
              <option value="winter">Winter</option>
              <option value="summer">Summer</option>
            </select>
          </label>
          <label>Winter Rate ($/CCF)
            <input id="winter-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Summer Rate ($/CCF)
            <input id="summer-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Fixed Charge
            <input id="sewer-fixed-charge" type="number" step="0.01" value="0" />
          </label>
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'drought_surcharge') {
    root.innerHTML = `
      <div class="module-panel" style="box-shadow:none;margin-top:.75rem;">
        <h3 class="module-panel-title">Drought / Conservation Surcharge</h3>
        <div class="form-grid">
          <label>Base Usage Rate ($/CCF)
            <input id="usage-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Surcharge Threshold (CCF)
            <input id="surcharge-threshold-ccf" type="number" step="0.01" value="0" />
          </label>
          <label>Surcharge Rate ($/CCF)
            <input id="surcharge-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Fixed Charge
            <input id="sewer-fixed-charge" type="number" step="0.01" value="0" />
          </label>
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'budget_rate') {
    root.innerHTML = `
      <div class="module-panel" style="box-shadow:none;margin-top:.75rem;">
        <h3 class="module-panel-title">California-style Budget Rate</h3>
        <div class="form-grid">
          <label>Monthly Budget (CCF)
            <input id="monthly-budget-ccf" type="number" step="0.01" value="0" />
          </label>
          <label>Inside Budget Rate ($/CCF)
            <input id="inside-budget-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Excess Budget Rate ($/CCF)
            <input id="excess-budget-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Fixed Charge
            <input id="sewer-fixed-charge" type="number" step="0.01" value="0" />
          </label>
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'ny_style') {
    root.innerHTML = `
      <div class="module-panel" style="box-shadow:none;margin-top:.75rem;">
        <h3 class="module-panel-title">NY-style Fixed + Metered</h3>
        <div class="form-grid">
          <label>Fixed Service Charge
            <input id="fixed-service-charge" type="number" step="0.01" value="0" />
          </label>
          <label>Frontage Charge
            <input id="frontage-charge" type="number" step="0.01" value="0" />
          </label>
          <label>Usage Rate ($/CCF)
            <input id="usage-rate" type="number" step="0.01" value="0" />
          </label>
          <label>Sewer Fixed Charge
            <input id="sewer-fixed-charge" type="number" step="0.01" value="0" />
          </label>
        </div>
      </div>
    `;
  }
}

async function saveBillingProfile() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const payload = {
    utility_id: utility.id,
    name: val('billing-profile-name'),
    customer_class: val('billing-customer-class'),
    billing_mode: val('billing-mode'),
    reading_unit: val('billing-reading-unit'),
    currency_symbol: val('currency-symbol') || '$',
    fixed_water_charge: numberOrZero(val('fixed-water-charge')),
    fixed_service_charge: numberOrZero(val('fixed-service-charge')),
    frontage_charge: numberOrZero(val('frontage-charge')),
    usage_rate: numberOrZero(val('usage-rate')),
    sewer_fixed_charge: numberOrZero(val('sewer-fixed-charge')),
    sewer_volumetric_rate: numberOrZero(val('sewer-volumetric-rate')),
    minimum_bill: numberOrZero(val('minimum-bill')),
    utility_tax_percent: numberOrZero(val('utility-tax-percent')),
    season: val('season'),
    winter_rate: numberOrZero(val('winter-rate')),
    summer_rate: numberOrZero(val('summer-rate')),
    surcharge_threshold_ccf: numberOrZero(val('surcharge-threshold-ccf')),
    surcharge_rate: numberOrZero(val('surcharge-rate')),
    monthly_budget_ccf: numberOrZero(val('monthly-budget-ccf')),
    inside_budget_rate: numberOrZero(val('inside-budget-rate')),
    excess_budget_rate: numberOrZero(val('excess-budget-rate')),
    tiers: readTierRows(),
    active: true
  };

  if (!payload.name) {
    alert('Billing profile name is required.');
    return;
  }

  await createBillingProfile(payload);
  alert('Billing profile saved.');
  await initBillingUi();
}

function readTierRows() {
  const tiers = [];

  for (let i = 0; i < 4; i += 1) {
    const from = val(`tier-from-${i}`);
    const to = val(`tier-to-${i}`);
    const rate = val(`tier-rate-${i}`);

    if (!from && !to && !rate) continue;

    tiers.push({
      from: numberOrZero(from),
      to: to === '' ? null : numberOrZero(to),
      rate: numberOrZero(rate)
    });
  }

  return tiers;
}

async function generateReceipts() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const billingMonth = val('receipt-billing-month');
  const profileId = val('receipt-billing-profile-id');
  const profile = billingProfiles.find((item) => item.id === profileId);

  if (!billingMonth) {
    alert('Select billing month.');
    return;
  }

  if (!profile) {
    alert('Select billing profile.');
    return;
  }

  const reads = await getMeterReadsByMonth(utility.id, billingMonth);

  if (!reads.length) {
    alert('No meter reads found for this month.');
    return;
  }

  let createdCount = 0;

  for (const read of reads) {
    const customer = customers.find((item) => item.id === read.customer_id);
    if (!customer) continue;

    const usageCcf = Number(read.usage_ccf || 0) || Number(read.usage_gal || 0) / 748;
    const bill = calculateBill({ usageCcf, profile });

    const receiptPayload = {
      utility_id: utility.id,
      customer_id: read.customer_id,
      meter_read_id: read.id,
      receipt_number: buildReceiptNumber(customer.account_number, billingMonth),
      billing_month: billingMonth,
      issue_date: todayDate(),
      due_date: addDaysDate(21),
      previous_read: read.previous_read,
      current_read: read.current_read,
      usage_ccf: bill.usage_ccf,
      usage_gal: Number(read.usage_gal || bill.usage_ccf * 748),
      water_charge: bill.water_charge,
      sewer_charge: bill.sewer_charge,
      fees: Number(read.fees || 0),
      adjustments: Number(read.adjustments || 0),
      taxes: bill.taxes,
      total_due: bill.total_due + Number(read.fees || 0) + Number(read.adjustments || 0),
      status: 'draft',
      emailed_to: customer.billing_email || null
    };

    try {
      await createBillingReceipt(receiptPayload);
      createdCount += 1;
    } catch (error) {
      console.warn('Receipt skipped:', error.message);
    }
  }

  await refreshReceipts();
  alert(`${createdCount} receipt(s) generated.`);
}

async function refreshReceipts() {
  const list = document.getElementById('receipt-list');
  const utility = authState.utility;

  if (!list || !utility?.id) return;

  const receipts = await getReceiptsByUtility(utility.id);

  if (!receipts.length) {
    list.innerHTML = '<p>No receipts generated yet.</p>';
    return;
  }

  list.innerHTML = receipts.map((receipt) => `
    <div class="mini-card">
      <strong>${safe(receipt.receipt_number)}</strong><br />
      <span>
        ${safe(receipt.customers?.account_number || 'No Account')}
        — ${safe(receipt.customers?.customer_name || 'Unnamed Customer')}
      </span><br />
      <small>
        Month: ${safe(receipt.billing_month)}
        • Total Due: ${formatMoney(receipt.total_due)}
        • Status: ${safe(receipt.status)}
      </small>

      <div class="button-row">
        <button
          class="btn-secondary receipt-pdf-btn"
          type="button"
          data-receipt-id="${safe(receipt.id)}"
        >
          Download PDF
        </button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.receipt-pdf-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const receipt = receipts.find((item) => item.id === button.dataset.receiptId);
      if (!receipt) return;

      downloadReceiptPdf({
        utility: authState.utility,
        receipt
      });
    });
  });
}

function buildReceiptNumber(accountNumber, billingMonth) {
  return `R-${billingMonth.replace('-', '')}-${accountNumber}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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