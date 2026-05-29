import { authState } from '../auth/auth.js';
import { getDmasByUtility } from '../supabase/dmas.js';
import { upsertCustomer, getCustomersByUtility } from '../supabase/customers.js';
import { geocodeAddress, getCurrentGpsPosition } from '../gis/geocode.js';
import { savePendingCustomer } from '../offline/offlineStore.js';
import { renderOfflineStatus } from '../offline/offlineUi.js';
import { parseCsv } from '../utils/csv.js';
import {
  modulePage,
  moduleToolbar,
  modulePanel,
  moduleKpis,
  emptyState,
  safe
} from '../ui/moduleLayout.js';
import { logAuditEvent } from '../audit/logAuditEvent.js';
import { showSuccess, showError } from '../ui/toast.js';


let dmas = [];
let customers = [];
let editingCustomerId = null;

export async function initCustomerMeterSetup(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  [dmas, customers] = await Promise.all([
    getDmasByUtility(utility.id),
    getCustomersByUtility(utility.id)
  ]);

  render(root);
  wireEvents();
}

function render(root) {
  const mappedCount = customers.filter((c) =>
    Number.isFinite(Number(c.meter_lat || c.service_lat)) &&
    Number.isFinite(Number(c.meter_lon || c.service_lon))
  ).length;

  root.innerHTML = modulePage({
    header: moduleToolbar({
      title: 'Customers & Meters',
      description:
        'Create, import, edit, and map customer meter records. These records power billing, field meter reads, GIS mapping, routes, and NRW analysis.',
      actions: `
        <label class="btn-secondary" style="display:inline-flex;align-items:center;gap:.5rem;">
          Import CSV
          <input id="customer-csv-file" type="file" accept=".csv" hidden />
        </label>
      `
    }),

    kpis: moduleKpis([
      { label: 'Customers', value: customers.length },
      { label: 'Mapped Meters', value: mappedCount },
      { label: 'DMAs', value: dmas.length },
      { label: 'Edit Mode', value: editingCustomerId ? 'Active' : 'New' }
    ]),

    body: `
      <div class="module-workspace">
        ${modulePanel({
          title: editingCustomerId ? 'Edit Customer + Meter' : 'Create Customer + Meter',
          subtitle: 'Capture account, meter, DMA, GPS, and field access information.',
          body: customerFormHtml()
        })}

        ${modulePanel({
          title: 'Customer Records',
          subtitle: 'Latest saved customers and meter mapping status.',
          className: 'inspector-panel',
          body: customerListHtml()
        })}
      </div>
    `
  });
}

function customerFormHtml() {
  return `
    <div class="form-grid">
      <label>Account Number
        <input id="customer-account-number" placeholder="100001" />
      </label>

      <label>Customer Name
        <input id="customer-name" placeholder="John Smith" />
      </label>

      <label>Customer Class
        <select id="customer-class">
          <option value="">Select Customer Class</option>
          <option value="Residential">Residential</option>
          <option value="Commercial">Commercial</option>
          <option value="Industrial">Industrial</option>
          <option value="Institutional">Institutional</option>
          <option value="Government">Government</option>
          <option value="Irrigation">Irrigation</option>
          <option value="Wholesale">Wholesale</option>
          <option value="Fire Service">Fire Service</option>
          <option value="Construction">Construction</option>
        </select>
      </label>

      <label>Account Type
        <select id="customer-account-type">
          <option value="Water">Water</option>
          <option value="Water/Sewer">Water/Sewer</option>
          <option value="Irrigation">Irrigation</option>
        </select>
      </label>

      <label>DMA
        <select id="customer-dma-id">
          <option value="">Unassigned</option>
          ${dmas.map((dma) => `
            <option value="${safe(dma.id)}">${safe(dma.name)}</option>
          `).join('')}
        </select>
      </label>

      <label>Meter Number
        <input id="customer-meter-number" placeholder="MTR-001" />
      </label>

      <label>Meter Size
        <select id="meter-size">
          <option value="">Select Meter Size</option>
          <option value='5/8"'>5/8"</option>
          <option value='3/4"'>3/4"</option>
          <option value='1"'>1"</option>
          <option value='1.5"'>1.5"</option>
          <option value='2"'>2"</option>
          <option value='3"'>3"</option>
          <option value='4"'>4"</option>
          <option value='6"'>6"</option>
          <option value='8"'>8"</option>
          <option value='10"'>10"</option>
          <option value='12"'>12"</option>
        </select>
      </label>

      <label>Meter Type
        <select id="meter-type">
          <option value="">Select Meter Type</option>
          <option value="AMI">AMI / Smart Meter</option>
          <option value="Manual">Manual Read</option>
          <option value="Compound">Compound Meter</option>
          <option value="Ultrasonic">Ultrasonic</option>
          <option value="Magnetic">Magnetic</option>
          <option value="Turbine">Turbine</option>
          <option value="Positive Displacement">Positive Displacement</option>
          <option value="Electromagnetic">Electromagnetic</option>
          <option value="Vault Meter">Vault Meter</option>
        </select>
      </label>

      <label>Service Status
        <select id="service-status">
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Disconnected">Disconnected</option>
          <option value="Pending">Pending</option>
        </select>
      </label>

      <label>Service Address
        <input id="customer-service-address" placeholder="123 Main Street" />
      </label>

      <label>City
        <input id="customer-city" placeholder="Atlanta" />
      </label>

      <label>State
        <input id="customer-state" placeholder="GA" />
      </label>

      <label>ZIP
        <input id="customer-zip" placeholder="30301" />
      </label>

      <label>Pressure Zone
        <input id="pressure-zone" placeholder="North Zone" />
      </label>

      <label>Route Sequence
        <input id="route-sequence" type="number" placeholder="101" />
      </label>

      <label>Install Date
        <input id="meter-install-date" type="date" />
      </label>

      <label>Service Latitude
        <input id="customer-service-lat" type="number" step="0.000001" />
      </label>

      <label>Service Longitude
        <input id="customer-service-lon" type="number" step="0.000001" />
      </label>

      <label>Meter Latitude
        <input id="customer-meter-lat" type="number" step="0.000001" />
      </label>

      <label>Meter Longitude
        <input id="customer-meter-lon" type="number" step="0.000001" />
      </label>

      <label>Meter Location Status
        <select id="customer-meter-location-status">
          <option value="Needs Verification">Needs Verification</option>
          <option value="Address Geocoded">Address Geocoded</option>
          <option value="GPS Verified">GPS Verified</option>
          <option value="Manually Corrected">Manually Corrected</option>
          <option value="Imported GPS">Imported GPS</option>
        </select>
      </label>

      <label>Meter Access Type
        <select id="meter-access-type">
          <option value="">Select Access Type</option>
          <option value="Front Yard">Front Yard</option>
          <option value="Back Yard">Back Yard</option>
          <option value="Side Yard">Side Yard</option>
          <option value="Basement">Basement</option>
          <option value="Crawlspace">Crawlspace</option>
          <option value="Vault">Vault</option>
          <option value="Inside Building">Inside Building</option>
          <option value="Mechanical Room">Mechanical Room</option>
          <option value="Street Box">Street Box</option>
          <option value="Driveway">Driveway</option>
          <option value="Locked Gate">Locked Gate</option>
        </select>
      </label>

      <label>Phone
        <input id="customer-phone" placeholder="555-555-5555" />
      </label>

      <label>Billing Email
        <input id="customer-billing-email" type="email" placeholder="customer@email.com" />
      </label>
    </div>

    <label>Meter Location Note
      <textarea id="customer-meter-location-note" rows="3" placeholder="Notes for field reader"></textarea>
    </label>

    <div class="module-action-bar">
      <button id="geocode-customer-btn" class="btn-secondary" type="button">Geocode Address</button>
      <button id="gps-customer-btn" class="btn-secondary" type="button">Use Current GPS</button>
      <button id="save-customer-btn" class="btn-primary" type="button">
        ${editingCustomerId ? 'Update Customer + Meter' : 'Save Customer + Meter'}
      </button>
      <button id="clear-customer-btn" class="btn-secondary" type="button">Clear</button>
    </div>
  `;
}

function customerListHtml() {
  if (!customers.length) {
    return emptyState('No customers created yet.');
  }

  return `
    <div class="compact-list">
      ${customers.map((customer) => {
        const hasGps =
          Number.isFinite(Number(customer.meter_lat || customer.service_lat)) &&
          Number.isFinite(Number(customer.meter_lon || customer.service_lon));

        return `
          <div class="mini-card">
            <strong>${safe(customer.account_number)} — ${safe(customer.customer_name || 'Unnamed Customer')}</strong><br />
            <span>${safe(customer.service_address || 'No address')}</span><br />
            <small>
              Meter: ${safe(customer.meter_number || '—')}
              • DMA: ${safe(customer.dmas?.name || customer.dma_id || 'Unassigned')}
            </small>

            <div style="margin-top:.5rem;">
              <span class="status-badge ${hasGps ? 'status-ok' : 'status-warn'}">
                ${hasGps ? 'Mapped' : 'Needs GPS'}
              </span>
              <span class="status-badge status-ok">
                ${safe(customer.meter_location_status || 'Active')}
              </span>
            </div>

            <div class="button-row">
              <button
                class="btn-secondary edit-customer-btn"
                type="button"
                data-customer-id="${safe(customer.id)}"
              >
                Edit
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function wireEvents() {
  document.getElementById('save-customer-btn')?.addEventListener('click', saveCustomer);
  document.getElementById('geocode-customer-btn')?.addEventListener('click', geocodeCustomerAddress);
  document.getElementById('gps-customer-btn')?.addEventListener('click', useCurrentGps);
  document.getElementById('clear-customer-btn')?.addEventListener('click', clearAndReset);

  document
    .getElementById('customer-csv-file')
    ?.addEventListener('change', importCustomersCsv);

  document.querySelectorAll('.edit-customer-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const customer = customers.find((item) => item.id === button.dataset.customerId);
      if (customer) fillCustomerForm(customer);
    });
  });
}

async function saveCustomer() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const accountNumber = val('customer-account-number');

  if (!accountNumber) {
    alert('Account number is required.');
    return;
  }

  const payload = {
  utility_id: utility.id,

  dma_id: val('customer-dma-id') || null,

  account_number: accountNumber,
  customer_name: val('customer-name'),

  customer_class: val('customer-class'),
  account_type: val('customer-account-type'),

  meter_number: val('customer-meter-number'),

  meter_size: val('meter-size'),
  meter_type: val('meter-type'),

  service_status: val('service-status'),

  service_address: val('customer-service-address'),
  city: val('customer-city'),
  state: val('customer-state'),
  zip: val('customer-zip'),

  pressure_zone: val('pressure-zone'),

  route_sequence:
    numberOrNull(val('route-sequence')),

  meter_install_date:
    val('meter-install-date') || null,

  service_lat:
    numberOrNull(val('customer-service-lat')),

  service_lon:
    numberOrNull(val('customer-service-lon')),

  meter_lat:
    numberOrNull(val('customer-meter-lat')),

  meter_lon:
    numberOrNull(val('customer-meter-lon')),

  meter_location_status:
    val('customer-meter-location-status'),

  meter_location_note:
    val('customer-meter-location-note'),

  phone: val('customer-phone'),

  billing_email:
    val('customer-billing-email'),

  meter_access_type:
    val('meter-access-type'),

  active: true
};

  let savedCustomer = null;
let savedOffline = false;

try {
  if (!navigator.onLine) {
    await savePendingCustomer(payload);
    savedOffline = true;

    showWarning('Device is offline. Customer saved locally and will sync later.');
  } else {
    savedCustomer = await upsertCustomer(payload);

    await logAuditEvent({
      action: editingCustomerId ? 'customer_updated' : 'customer_created',
      entityType: 'customer',
      entityId: savedCustomer.id,
      details: {
        account_number: savedCustomer.account_number,
        customer_name: savedCustomer.customer_name,
        meter_number: savedCustomer.meter_number
      }
    });

    showSuccess(
      editingCustomerId
        ? 'Customer updated.'
        : 'Customer and meter saved.'
    );
  }
} catch (error) {
  console.warn('Online customer save failed. Saving offline instead:', error.message);

  await savePendingCustomer(payload);
  savedOffline = true;

  showWarning('Customer saved locally because online save failed.');
}

editingCustomerId = null;

await reloadCustomers();
await renderOfflineStatus('offline-status-root');
}



async function importCustomersCsv(event) {
  const utility = authState.utility;
  const file = event.target.files?.[0];

  if (!utility?.id || !file) return;

  const text = await file.text();
  const rows = parseCsv(text);

  if (!rows.length) {
    alert('CSV file is empty.');
    return;
  }

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
  await reloadCustomers();
}

async function geocodeCustomerAddress() {
  const fullAddress = [
    val('customer-service-address'),
    val('customer-city'),
    val('customer-state'),
    val('customer-zip')
  ].filter(Boolean).join(', ');

  if (!fullAddress) {
    alert('Enter service address first.');
    return;
  }

  try {
    const result = await geocodeAddress(fullAddress);

    if (!result) {
      alert('No geocode result found.');
      return;
    }

    setValue('customer-service-lat', result.lat);
    setValue('customer-service-lon', result.lon);
    setValue('customer-meter-lat', result.lat);
    setValue('customer-meter-lon', result.lon);
    setValue('customer-meter-location-status', 'Address Geocoded');

    alert('Address geocoded.');
  } catch (error) {
    alert(error.message);
  }
}

async function useCurrentGps() {
  try {
    const gps = await getCurrentGpsPosition();

    setValue('customer-meter-lat', gps.lat);
    setValue('customer-meter-lon', gps.lon);
    setValue('customer-meter-location-status', 'GPS Verified');

    alert(`GPS captured. Accuracy: ${Math.round(gps.accuracy)} meters`);
  } catch (error) {
    alert(error.message || 'GPS failed.');
  }
}

function fillCustomerForm(customer) {
  editingCustomerId = customer.id;

  setValue('customer-account-number', customer.account_number);
  setValue('customer-name', customer.customer_name);
  setValue('customer-class', customer.customer_class || 'Residential');
  setValue('customer-account-type', customer.account_type || 'Water');
  setValue('customer-dma-id', customer.dma_id || '');
  setValue('customer-meter-number', customer.meter_number);
  setValue('customer-meter-size', customer.meter_size);
  setValue('customer-meter-type', customer.meter_type);
  setValue('customer-service-address', customer.service_address);
  setValue('customer-city', customer.city);
  setValue('customer-state', customer.state);
  setValue('customer-zip', customer.zip);
  setValue('customer-service-lat', customer.service_lat);
  setValue('customer-service-lon', customer.service_lon);
  setValue('customer-meter-lat', customer.meter_lat);
  setValue('customer-meter-lon', customer.meter_lon);
  setValue('customer-meter-location-status', customer.meter_location_status || 'Needs Verification');
  setValue('customer-meter-location-note', customer.meter_location_note);
  setValue('customer-phone', customer.phone);
  setValue('customer-billing-email', customer.billing_email);
  setValue('customer-meter-access-type', customer.meter_access_type);

  const saveBtn = document.getElementById('save-customer-btn');
  if (saveBtn) saveBtn.textContent = 'Update Customer + Meter';

  document.getElementById('customer-account-number')?.focus();
}

async function reloadCustomers() {
  const utility = authState.utility;
  if (!utility?.id) return;

  customers = await getCustomersByUtility(utility.id);

  const root = document.getElementById('dashboard-module-root');
  if (root) {
    render(root);
    wireEvents();
  }
}

function clearAndReset() {
  editingCustomerId = null;
  clearCustomerForm();

  const saveBtn = document.getElementById('save-customer-btn');
  if (saveBtn) saveBtn.textContent = 'Save Customer + Meter';
}

function clearCustomerForm() {
  [
    'customer-account-number',
    'customer-name',
    'customer-meter-number',
    'customer-meter-size',
    'customer-meter-type',
    'customer-service-address',
    'customer-city',
    'customer-state',
    'customer-zip',
    'customer-service-lat',
    'customer-service-lon',
    'customer-meter-lat',
    'customer-meter-lon',
    'customer-meter-location-note',
    'customer-phone',
    'customer-billing-email',
    'customer-meter-access-type'
  ].forEach((id) => setValue(id, ''));

  setValue('customer-dma-id', '');
  setValue('customer-class', 'Residential');
  setValue('customer-account-type', 'Water');
  setValue('customer-meter-location-status', 'Needs Verification');
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