import { authState } from '../auth/auth.js';
import { updateUtility } from '../supabase/utilities.js';
import { createDma, getDmasByUtility } from '../supabase/dmas.js';
import { updateDma } from '../supabase/dmas.js';
import { uploadUtilityLogo } from '../supabase/storage.js';
import { applyUtilityTheme } from '../ui/theme.js';
import { requireTabAccess } from '../auth/permissions.js';
import { logAuditEvent } from '../audit/logAuditEvent.js';

let currentUtility = null;
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

  <div style="margin-top:1rem;">
    <h3>Existing DMAs</h3>
    <p class="module-panel-subtitle">
      Use Utility Setup to define DMA details. Use the Map tab to draw or redraw DMA boundaries.
    </p>
    <div id="dma-list"></div>
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

  document
    .getElementById('clear-dma-btn')
    ?.addEventListener('click', () => {
      clearDmaForm();
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

  authState.utility = currentUtility;
  applyUtilityTheme(currentUtility);

  setValue('utility-logo-url', logoUrl);

  alert('Utility profile saved successfully.');
  await logAuditEvent({
  action: 'utility_updated',
  entityType: 'utility',
  entityId: utility.id,
  details: {
    utility_name: utility.name
  }
});
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

async function refreshDmaList() {
  const list = document.getElementById('dma-list');
  if (!list) return;

  const dmas = await getDmasByUtility(currentUtility.id);

  if (!dmas.length) {
    list.innerHTML = '<p>No DMAs created yet.</p>';
    return;
  }

  list.innerHTML = dmas.map((dma) => `
  <div class="mini-card">
    <strong>${safe(dma.name)}</strong><br />
    <span>
      Code: ${safe(dma.code || '—')}
      • City: ${safe(dma.city || '—')}
      • Zone: ${safe(dma.pressure_zone || '—')}
    </span><br />
    <small>
      Type: ${safe(dma.dma_type || 'Distribution')}
      • Status: ${safe(dma.status || 'Active')}
    </small><br />
    <small>
      Center: ${safe(dma.center_lat || '—')}, ${safe(dma.center_lon || '—')}
    </small>

    <div class="button-row">
      <button
        class="btn-secondary edit-dma-btn"
        type="button"
        data-dma-id="${safe(dma.id)}"
      >
        Edit DMA
      </button>

      <button
        class="btn-secondary"
        type="button"
        onclick="alert('Open the Map tab, click Draw DMA Boundary, then select this DMA.')"
      >
        Draw Boundary on Map
      </button>
    </div>
  </div>
`).join('');

document.querySelectorAll('.edit-dma-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const dma = dmas.find((item) => item.id === button.dataset.dmaId);
    if (dma) fillDmaForm(dma);
  });
});
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