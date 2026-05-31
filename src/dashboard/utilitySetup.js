import { authState } from '../auth/auth.js';
import { updateUtility } from '../supabase/utilities.js';
import { createDma, getDmasByUtility } from '../supabase/dmas.js';
import { updateDma } from '../supabase/dmas.js';
import { uploadUtilityLogo } from '../supabase/storage.js';
import { applyUtilityTheme } from '../ui/theme.js';
import { requireTabAccess } from '../auth/permissions.js';
import { logAuditEvent } from '../audit/logAuditEvent.js';
import { showSuccess, showError } from '../ui/toast.js';


let currentUtility = null;
let editingDmaId = null;
let dmaCache = [];
let editingDmaId = null;

export async function initUtilitySetup(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);

  currentUtility = authState.utility;
  if (!root || !currentUtility?.id) return;

  render(root, currentUtility);
  await refreshDmaList();
  wireEvents();
}

function render(root, currentUtility) {
  root.innerHTML = `
    <section class="card">
      <h2>Utility Setup</h2>
      <p>Configure utility identity, contact details, and branding.</p>

      <div class="form-grid">
        <label>Utility Name
          <input id="utility-name" value="${safe(currentUtility.name)}" />
        </label>

        <label>Legal Name
          <input id="utility-legal-name" value="${safe(currentUtility.legal_name)}" />
        </label>

        <label>State
          <input id="utility-state" value="${safe(currentUtility.state)}" />
        </label>

        <label>Website
          <input id="utility-website" value="${safe(currentUtility.website)}" />
        </label>

        <label>Billing Email
          <input id="utility-billing-email" value="${safe(currentUtility.billing_email)}" />
        </label>

        <label>Support Email
          <input id="utility-support-email" value="${safe(currentUtility.support_email)}" />
        </label>

        <label>Phone
          <input id="utility-phone" value="${safe(currentUtility.phone)}" />
        </label>

        <label>Address
          <input id="utility-address" value="${safe(currentUtility.address)}" />
        </label>

        <label>Primary Color
          <input id="utility-primary-color" type="color" value="${safe(currentUtility.primary_color || '#06b6d4')}" />
        </label>

        <label>Secondary Color
          <input id="utility-secondary-color" type="color" value="${safe(currentUtility.secondary_color || '#1a4b66')}" />
        </label>

       <label>Utility Logo
            <input id="utility-logo-file" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>

          <label>Saved Logo URL
            <input id="utility-logo-url" value="${safe(currentUtility.logo_url || '')}" readonly />
          </label>
      </div>

      <button id="save-utility-btn" class="btn-primary">Save Utility Profile</button>
      <button id="geocode-dma-btn" class="btn-secondary" type="button">
  Fill Lat/Lon from Address
</button>
    </section>

    <section class="card" style="margin-top:1rem;">
  <h2>DMA / Metered Area Setup</h2>
  <p>Create District Metered Areas for NRW, mapping, billing, and field routing.</p>

  <div class="form-grid">
    <label>DMA Name
      <input id="dma-name" placeholder="Downtown DMA" />
    </label>

    <label>DMA Code
      <input id="dma-code" placeholder="DMA-001" />
    </label>

    <label>DMA Type
      <select id="dma-type">
        <option value="Distribution">Distribution</option>
        <option value="Transmission">Transmission</option>
        <option value="Pressure Zone">Pressure Zone</option>
        <option value="Pilot Area">Pilot Area</option>
      </select>
    </label>

    <label>Status
      <select id="dma-status">
        <option value="Active">Active</option>
        <option value="Planning">Planning</option>
        <option value="Needs Boundary">Needs Boundary</option>
        <option value="Inactive">Inactive</option>
      </select>
    </label>

    <label>City
      <input id="dma-city" placeholder="Mobile" />
    </label>

    <label>State
      <input id="dma-state" placeholder="AL" />
    </label>

    <label>ZIP
      <input id="dma-zip" placeholder="36602" />
    </label>

    <label>Pressure Zone
      <input id="dma-pressure-zone" placeholder="Downtown Pressure Zone" />
    </label>

    <label>Center Latitude
      <input id="dma-center-lat" type="number" step="0.000001" />
    </label>

    <label>Center Longitude
      <input id="dma-center-lon" type="number" step="0.000001" />
    </label>
  </div>

  <div class="button-row">
    <button id="save-dma-btn" class="btn-primary" type="button">
      Save DMA
    </button>

    <button id="clear-dma-btn" class="btn-secondary" type="button">
      Clear
    </button>
  </div>

  <div class="module-panel" style="margin-top:1rem;">
  <div class="module-panel-header">
    <div>
      <h3 class="module-panel-title">Existing DMAs</h3>
      <p class="module-panel-subtitle">
        Use Utility Setup to define DMA details. Use the Map tab to draw or redraw DMA boundaries.
      </p>
    </div>
  </div>

  <div class="module-table-wrap">
    <table class="table-clean">
      <thead>
        <tr>
          <th>Name</th>
          <th>Code</th>
          <th>City</th>
          <th>Zone</th>
          <th>Status</th>
          <th>Type</th>
          <th>Center</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody id="dma-table-body">
        <tr>
          <td colspan="8">Loading DMAs...</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
</section>
  `;
}

function wireEvents() {
  document
    .getElementById('save-utility-btn')
    ?.addEventListener('click', saveUtility);

  document
    .getElementById('save-dma-btn')
    ?.addEventListener('click', saveDma);

  document
    .getElementById('utility-primary-color')
    ?.addEventListener('input', previewTheme);

  document
    .getElementById('utility-secondary-color')
    ?.addEventListener('input', previewTheme);

  document.getElementById('clear-dma-btn')?.addEventListener('click', (event) => {
  clearDmaForm();
  setActiveButton('#clear-dma-btn', event.currentTarget);
  document.getElementById('geocode-dma-btn')?.addEventListener('click', geocodeDmaAddress);
});
}

function previewTheme() {
  applyUtilityTheme({
    primary_color: val('utility-primary-color'),
    secondary_color: val('utility-secondary-color')
  });
}

async function saveUtility() {
  let logoUrl = val('utility-logo-url');

  const logoFile = document.getElementById('utility-logo-file')?.files?.[0];

  if (logoFile) {
    logoUrl = await uploadUtilityLogo({
      utilityId: currentUtility.id,
      file: logoFile
    });
  }

  const payload = {
  name: val('utility-name'),
  legal_name: val('utility-legal-name'),
  state: val('utility-state'),
  website: val('utility-website'),

  billing_email: val('utility-billing-email'),
  support_email: val('utility-support-email'),

  phone: val('utility-phone'),
  address: val('utility-address'),

  primary_color: val('utility-primary-color') || '#06b6d4',
  secondary_color: val('utility-secondary-color') || '#1a4b66',

  logo_url: logoUrl
};

await updateUtility(currentUtility.id, payload);

currentUtility = {
  ...currentUtility,
  ...payload
};

await logAuditEvent({
  action: 'utility_updated',
  entityType: 'utility',
  entityId: currentUtility.id,
  details: {
    utility_name: payload.name
  }
});

authState.utility = currentUtility;
applyUtilityTheme(currentUtility);

setValue('utility-logo-url', logoUrl);

await logAuditEvent({
  action: 'utility_updated',
  entityType: 'utility',
  entityId: currentUtility.id,
  details: {
    utility_name: currentUtility.name
  }
});

showSuccess('Utility profile saved successfully.');
}

async function saveDma() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const payload = {
  utility_id: utility.id,
  name: val('dma-name'),
  code: val('dma-code'),
  city: val('dma-city'),
  state: val('dma-state'),
  zip: val('dma-zip'),
  pressure_zone: val('dma-pressure-zone'),
  dma_type: val('dma-type'),
  status: val('dma-status') || 'Active',
  center_lat: numberOrNull(val('dma-center-lat')),
  center_lon: numberOrNull(val('dma-center-lon'))
};

  if (!payload.name) {
    alert('DMA name is required.');
    return;
  }

  if (editingDmaId) {
    await updateDma(editingDmaId, payload);
    alert('DMA updated.');
  } else {
    await createDma(payload);
    alert('DMA created.');
  }

  editingDmaId = null;
  clearDmaForm();

  const saveBtn = document.getElementById('save-dma-btn');
  if (saveBtn) saveBtn.textContent = 'Save DMA';

  await refreshDmaList();
}
 
function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function clearDmaForm() {
  [
    'dma-name',
    'dma-code',
    'dma-city',
    'dma-state',
    'dma-zip',
    'dma-pressure-zone',
    'dma-center-lat',
    'dma-center-lon',
    'dma-type',
    'dma-status'
  ].forEach((id) => setValue(id, ''));

  setValue('dma-type', 'Distribution');
  setValue('dma-status', 'Active');

  editingDmaId = null;

  const saveBtn = document.getElementById('save-dma-btn');

  if (saveBtn) {
    saveBtn.textContent = 'Save DMA';
  }
}

function setActiveButton(selector, activeButton) {
  document.querySelectorAll(selector).forEach((button) => {
    button.classList.remove('btn-primary');
    button.classList.add('btn-secondary');
  });

  activeButton.classList.remove('btn-secondary');
  activeButton.classList.add('btn-primary');
}

async function refreshDmaList() {
  const tbody = document.getElementById('dma-table-body');
  if (!tbody) return;

  dmaCache = await getDmasByUtility(currentUtility.id);

  if (!dmaCache.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">No DMAs created yet.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = dmaCache.map((dma) => `
    <tr>
      <td><strong>${safe(dma.name || 'Unnamed DMA')}</strong></td>
      <td>${safe(dma.code || '—')}</td>
      <td>${safe(dma.city || '—')}</td>
      <td>${safe(dma.pressure_zone || '—')}</td>
      <td><span class="status-badge status-ok">${safe(dma.status || 'Active')}</span></td>
      <td>${safe(dma.dma_type || 'Distribution')}</td>
      <td>
        ${dma.center_lat && dma.center_lon
          ? `${safe(dma.center_lat)}, ${safe(dma.center_lon)}`
          : '—'}
      </td>
      <td>
        <div class="button-row">
          <button class="btn-secondary edit-dma-btn" type="button" data-dma-id="${safe(dma.id)}">
            Edit
          </button>
          <button class="btn-secondary boundary-dma-btn" type="button" data-dma-id="${safe(dma.id)}">
            Boundary
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.edit-dma-btn').forEach((button) => {
    button.addEventListener('click', () => {
      editDma(button.dataset.dmaId);
      setActiveButton('.edit-dma-btn', button);
    });
  });

  document.querySelectorAll('.boundary-dma-btn').forEach((button) => {
    button.addEventListener('click', () => {
      alert('Open the Map tab, click Draw DMA Boundary, then select this DMA.');
      setActiveButton('.boundary-dma-btn', button);
    });
  });
}

function editDma(dmaId) {
  const dma = dmaCache.find((item) => item.id === dmaId);

  if (!dma) {
    alert('DMA record not found.');
    return;
  }

  editingDmaId = dma.id;

  setValue('dma-name', dma.name || '');
  setValue('dma-code', dma.code || '');
  setValue('dma-type', dma.dma_type || 'Distribution');
  setValue('dma-status', dma.status || 'Active');
  setValue('dma-city', dma.city || '');
  setValue('dma-state', dma.state || '');
  setValue('dma-zip', dma.zip || '');
  setValue('dma-pressure-zone', dma.pressure_zone || '');
  setValue('dma-center-lat', dma.center_lat || '');
  setValue('dma-center-lon', dma.center_lon || '');

  const saveBtn = document.getElementById('save-dma-btn');
  if (saveBtn) saveBtn.textContent = 'Update DMA';
}
  
function fillDmaForm(dma) {
  editingDmaId = dma.id;

  setValue('dma-name', dma.name);
  setValue('dma-code', dma.code);
  setValue('dma-city', dma.city);
  setValue('dma-state', dma.state);
  setValue('dma-zip', dma.zip);
  setValue('dma-pressure-zone', dma.pressure_zone);
  setValue('dma-center-lat', dma.center_lat);
  setValue('dma-center-lon', dma.center_lon);
  setValue('dma-type', dma.dma_type || 'Distribution');
setValue('dma-status', dma.status || 'Active');

  const saveBtn = document.getElementById('save-dma-btn');
  if (saveBtn) saveBtn.textContent = 'Update DMA';

  document.getElementById('dma-name')?.focus();
}

async function geocodeDmaAddress() {
  const city = val('dma-city');
  const state = val('dma-state');
  const zip = val('dma-zip');

  const utilityAddress = val('utility-address');

  const query = [
    utilityAddress,
    city,
    state,
    zip
  ].filter(Boolean).join(', ');

  if (!query) {
    alert('Enter city, state, ZIP, or utility address first.');
    return;
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;

    const response = await fetch(url);
    const results = await response.json();

    if (!results.length) {
      alert('Could not find coordinates for this address.');
      return;
    }

    setValue('dma-center-lat', results[0].lat);
    setValue('dma-center-lon', results[0].lon);

    alert('Latitude and longitude filled.');
  } catch (error) {
    console.error('Geocoding failed:', error);
    alert('Could not geocode address.');
  }
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}