import { authState } from '../auth/auth.js';
import { parseCsv } from '../utils/csv.js';
import { upsertCustomer, getCustomersByUtility } from '../supabase/customers.js';
import { getReceiptsByUtility } from '../supabase/receipts.js';
import { getNrwReportsByUtility } from '../supabase/nrw.js';

export async function initImportExportUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  root.innerHTML = `
    <section class="card section-card">
      <div class="module-header">
        <div>
          <div class="module-eyebrow">Data Management</div>
          <h2>Import / Export</h2>
          <p>Load customer datasets, meter GPS locations, DMA assignments, and export operational records.</p>
        </div>
      </div>

      <div class="module-grid two">
        <section class="panel">
          <h3 class="panel-title">Import Customers CSV</h3>
          <p class="panel-subtitle">
            Recommended columns: account_number, customer_name, meter_number, service_address, city, state, zip, customer_class, lat, lon
          </p>

          <input id="import-customers-file" type="file" accept=".csv" />

          <div class="button-row">
            <button id="import-customers-btn" class="btn-primary" type="button">
              Import Customers
            </button>
          </div>
        </section>

        <section class="panel">
          <h3 class="panel-title">Export Data</h3>
          <p class="panel-subtitle">Download operational data for reporting, backup, or external analysis.</p>

          <div class="button-row">
            <button id="export-customers-btn" class="btn-secondary" type="button">
              Export Customers CSV
            </button>

            <button id="export-receipts-btn" class="btn-secondary" type="button">
              Export Receipts CSV
            </button>

            <button id="export-nrw-btn" class="btn-secondary" type="button">
              Export NRW CSV
            </button>
          </div>
        </section>
      </div>

      <section class="panel" style="margin-top:1rem;">
        <h3 class="panel-title">Import Notes</h3>
        <ul class="data-notes">
          <li>Customer account number is required.</li>
          <li>Latitude/longitude can populate service and meter map points.</li>
          <li>Imported customers automatically appear on the GIS map when coordinates exist.</li>
          <li>Use DMA codes later to auto-assign customers to pressure zones.</li>
        </ul>
      </section>
    </section>
  `;

  wireEvents();
}

function wireEvents() {
  document
    .getElementById('import-customers-btn')
    ?.addEventListener('click', importCustomers);

  document
    .getElementById('export-customers-btn')
    ?.addEventListener('click', exportCustomers);

  document
    .getElementById('export-receipts-btn')
    ?.addEventListener('click', exportReceipts);

  document
    .getElementById('export-nrw-btn')
    ?.addEventListener('click', exportNrw);
}

async function importCustomers() {
  const utility = authState.utility;
  const file = document.getElementById('import-customers-file')?.files?.[0];

  if (!utility?.id || !file) {
    alert('Select a CSV file first.');
    return;
  }

  const text = await file.text();
  const rows = parseCsv(text);

  let imported = 0;

  for (const row of rows) {
    const accountNumber = row.account_number || row.account || row.Account;

    if (!accountNumber) continue;

    const lat = numberOrNull(row.meter_lat || row.service_lat || row.lat || row.latitude);
    const lon = numberOrNull(row.meter_lon || row.service_lon || row.lon || row.lng || row.longitude);

    const payload = {
      utility_id: utility.id,
      account_number: accountNumber,
      customer_name: row.customer_name || row.name || row.Name || '',
      customer_class: row.customer_class || row.class || 'Residential',

      meter_number: row.meter_number || row.meter || '',
      meter_size: row.meter_size || '',
      meter_type: row.meter_type || '',

      service_address: row.service_address || row.address || '',
      city: row.city || '',
      state: row.state || '',
      zip: row.zip || '',

      service_lat: lat,
      service_lon: lon,
      meter_lat: lat,
      meter_lon: lon,

      meter_location_status: lat && lon ? 'Imported GPS' : 'Needs Verification',

      billing_email: row.billing_email || row.email || '',
      phone: row.phone || '',

      active: true
    };

    await upsertCustomer(payload);
    imported += 1;
  }

  alert(`${imported} customer records imported.`);
}

async function exportCustomers() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const customers = await getCustomersByUtility(utility.id);

  downloadCsv(
    'customers.csv',
    customers,
    [
      'account_number',
      'customer_name',
      'customer_class',
      'meter_number',
      'service_address',
      'city',
      'state',
      'zip',
      'meter_lat',
      'meter_lon',
      'billing_email',
      'phone'
    ]
  );
}

async function exportReceipts() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const receipts = await getReceiptsByUtility(utility.id);

  downloadCsv(
    'billing_receipts.csv',
    receipts,
    [
      'receipt_number',
      'billing_month',
      'issue_date',
      'due_date',
      'usage_ccf',
      'usage_gal',
      'water_charge',
      'sewer_charge',
      'fees',
      'adjustments',
      'taxes',
      'total_due',
      'status'
    ]
  );
}

async function exportNrw() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const reports = await getNrwReportsByUtility(utility.id);

  downloadCsv(
    'nrw_reports.csv',
    reports,
    [
      'billing_month',
      'production_mgd',
      'days_in_period',
      'system_input_gal',
      'billed_consumption_gal',
      'authorized_consumption_gal',
      'nrw_gal',
      'nrw_percent',
      'revenue',
      'energy_kwh',
      'energy_cost'
    ]
  );
}

function downloadCsv(filename, rows, columns) {
  const header = columns.join(',');

  const body = rows.map((row) => {
    return columns.map((column) => {
      const value = row[column] ?? '';
      return `"${String(value).replaceAll('"', '""')}"`;
    }).join(',');
  }).join('\n');

  const blob = new Blob([`${header}\n${body}`], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}