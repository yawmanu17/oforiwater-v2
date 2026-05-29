import { authState } from '../auth/auth.js';
import { requireTabAccess } from '../auth/permissions.js';
import { getDmasByUtility } from '../supabase/dmas.js';
import {
  createMasterMeter,
  createPipeline,
  getMasterMetersByUtility,
  getPipelinesByUtility,
  deleteMasterMeter,
  deletePipeline
} from '../supabase/assets.js';

let dmas = [];

export async function initAssetSetup(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  dmas = await getDmasByUtility(utility.id);

  render(root);
  wireEvents();
  await refreshAssetLists();
}

function render(root) {
  root.innerHTML = `
    <section class="card section-card">
      <h2>Master Meter Setup</h2>
      <p>Add DMA master meters for NRW and production-flow analysis.</p>

      <div class="form-grid">
        <label>Name
          <input id="master-meter-name" placeholder="Downtown Master Meter" />
        </label>

        <label>Meter Number
          <input id="master-meter-number" placeholder="MM-001" />
        </label>

        <label>DMA
          <select id="master-meter-dma-id">
            <option value="">Unassigned</option>
            ${dmas.map((dma) => `
              <option value="${safe(dma.id)}">${safe(dma.name)}</option>
            `).join('')}
          </select>
        </label>

        <label>Latitude
          <input id="master-meter-lat" type="number" step="0.000001" />
        </label>

        <label>Longitude
          <input id="master-meter-lon" type="number" step="0.000001" />
        </label>

        <label>Pipe Size, in
          <input id="master-meter-pipe-size" type="number" step="0.01" />
        </label>

        <label>Inlet Pressure, psi
          <input id="master-meter-inlet-pressure" type="number" step="0.01" />
        </label>

        <label>Outlet Pressure, psi
          <input id="master-meter-outlet-pressure" type="number" step="0.01" />
        </label>

        <label>Monthly Flow, gal
          <input id="master-meter-monthly-flow" type="number" step="1" />
        </label>

        <label>Status
          <select id="master-meter-status">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Needs Inspection">Needs Inspection</option>
            <option value="Out of Service">Out of Service</option>
          </select>
        </label>
      </div>

      <button id="save-master-meter-btn" class="btn-primary" type="button">
        Save Master Meter
      </button>
    </section>

    <section class="card section-card">
      <h2>Pipeline Setup</h2>
      <p>Add simple pipeline records. Geometry can be upgraded later with drawing tools.</p>

      <div class="form-grid">
        <label>Pipeline Name
          <input id="pipeline-name" placeholder="Main Transmission Line" />
        </label>

        <label>Pipe Code
          <input id="pipeline-code" placeholder="PIPE-001" />
        </label>

        <label>DMA
          <select id="pipeline-dma-id">
            <option value="">Unassigned</option>
            ${dmas.map((dma) => `
              <option value="${safe(dma.id)}">${safe(dma.name)}</option>
            `).join('')}
          </select>
        </label>

        <label>Diameter, in
          <input id="pipeline-diameter" type="number" step="0.01" />
        </label>

        <label>Material
          <input id="pipeline-material" placeholder="PVC / DIP / Steel / HDPE" />
        </label>

        <label>Install Year
          <input id="pipeline-install-year" type="number" placeholder="2020" />
        </label>

        <label>Pressure Zone
          <input id="pipeline-pressure-zone" placeholder="Zone 1" />
        </label>

        <label>Status
          <select id="pipeline-status">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Needs Inspection">Needs Inspection</option>
            <option value="Abandoned">Abandoned</option>
          </select>
        </label>
      </div>

      <label>Notes
        <textarea id="pipeline-notes" rows="3" placeholder="Pipeline notes"></textarea>
      </label>

      <button id="save-pipeline-btn" class="btn-primary" type="button">
        Save Pipeline
      </button>
    </section>

    <section class="module-panel">
  <div class="module-panel-header">
    <div>
      <h3 class="module-panel-title">Saved Infrastructure Assets</h3>
      <p class="module-panel-subtitle">
        Master meters feed NRW calculations. Pipelines support GIS network visualization.
      </p>
    </div>
  </div>

  <div id="asset-kpi-root"></div>

  <div class="module-workspace">
    <section class="module-panel" style="box-shadow:none;">
      <div class="module-panel-header">
        <div>
          <h3 class="module-panel-title">Master Meters</h3>
          <p class="module-panel-subtitle">Production and DMA inflow points.</p>
        </div>
      </div>

      <div id="master-meter-list"></div>
    </section>

    <section class="module-panel" style="box-shadow:none;">
      <div class="module-panel-header">
        <div>
          <h3 class="module-panel-title">Pipelines</h3>
          <p class="module-panel-subtitle">Transmission, distribution, and service infrastructure.</p>
        </div>
      </div>

      <div id="pipeline-list"></div>
    </section>
  </div>
</section>
  `;
}

function assetKpisHtml(masterMeters = [], pipelines = []) {
  const totalAssets = masterMeters.length + pipelines.length;

  const activeAssets =
    masterMeters.filter((item) => item.status === 'Active').length +
    pipelines.filter((item) => item.status === 'Active').length;

  const needsReview =
    masterMeters.filter((item) =>
      ['Needs Inspection', 'Needs Calibration', 'Estimated', 'Out of Service'].includes(item.status)
    ).length +
    pipelines.filter((item) =>
      ['Needs Inspection', 'Critical', 'Leak Suspected', 'Inactive', 'Abandoned'].includes(item.status)
    ).length;

  const masterFlowGal = masterMeters.reduce(
    (sum, meter) => sum + Number(meter.monthly_flow_gal || 0),
    0
  );

  return `
    <div class="module-kpis">
      <div class="kpi-card">
        <div class="kpi-label">Total Assets</div>
        <div class="kpi-value">${totalAssets}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Master Meters</div>
        <div class="kpi-value">${masterMeters.length}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Pipelines</div>
        <div class="kpi-value">${pipelines.length}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Active Assets</div>
        <div class="kpi-value">${activeAssets}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Needs Review</div>
        <div class="kpi-value">${needsReview}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Master Flow</div>
        <div class="kpi-value">${Math.round(masterFlowGal).toLocaleString()} gal</div>
      </div>
    </div>
  `;
}

function wireEvents() {
  document
    .getElementById('save-master-meter-btn')
    ?.addEventListener('click', saveMasterMeter);

  document
    .getElementById('save-pipeline-btn')
    ?.addEventListener('click', savePipeline);
}

async function saveMasterMeter() {
  const utility = authState.utility;

  if (!utility?.id) return;

  const payload = {
    utility_id: utility.id,
    dma_id: val('master-meter-dma-id') || null,
    name: val('master-meter-name'),
    meter_number: val('master-meter-number'),
    lat: numberOrNull(val('master-meter-lat')),
    lon: numberOrNull(val('master-meter-lon')),
    pipe_size_in: numberOrNull(val('master-meter-pipe-size')),
    inlet_pressure_psi: numberOrNull(val('master-meter-inlet-pressure')),
    outlet_pressure_psi: numberOrNull(val('master-meter-outlet-pressure')),
    monthly_flow_gal:
      numberOrNull(val('master-meter-monthly-flow')) || 0,
    status: val('master-meter-status') || 'Active'
  };

  if (!payload.name) {
    alert('Master meter name is required.');
    return;
  }

  await createMasterMeter(payload);

  clearMasterMeterForm();
  await refreshAssetLists();

  alert('Master meter saved.');
}

async function savePipeline() {
  const utility = authState.utility;

  if (!utility?.id) return;

  const payload = {
    utility_id: utility.id,
    dma_id: val('pipeline-dma-id') || null,
    name: val('pipeline-name'),
    pipe_code: val('pipeline-code'),
    diameter_in: numberOrNull(val('pipeline-diameter')),
    material: val('pipeline-material'),
    install_year: integerOrNull(val('pipeline-install-year')),
    pressure_zone: val('pipeline-pressure-zone'),
    status: val('pipeline-status') || 'Active',
    notes: val('pipeline-notes')
  };

  if (!payload.name) {
    alert('Pipeline name is required.');
    return;
  }

  await createPipeline(payload);

  clearPipelineForm();
  await refreshAssetLists();

  alert('Pipeline saved.');
}

async function refreshAssetLists() {
  const utility = authState.utility;
  if (!utility?.id) return;

  const [masterMeters, pipelines] = await Promise.all([
    getMasterMetersByUtility(utility.id),
    getPipelinesByUtility(utility.id)
  ]);

  const kpiRoot = document.getElementById('asset-kpi-root');
  if (kpiRoot) {
    kpiRoot.innerHTML = assetKpisHtml(masterMeters, pipelines);
  }

  renderMasterMeterList(masterMeters);
  renderPipelineList(pipelines);
  wireAssetListActions();
}

function wireAssetListActions() {
  document.querySelectorAll('.delete-master-meter-btn').forEach((button) => {
    button.onclick = async () => {
      const confirmed = confirm('Delete this master meter? This cannot be undone.');
      if (!confirmed) return;

      await deleteMasterMeter(button.dataset.masterMeterId);
      await refreshAssetLists();

      alert('Master meter deleted.');
    };
  });

  document.querySelectorAll('.delete-pipeline-btn').forEach((button) => {
    button.onclick = async () => {
      const confirmed = confirm('Delete this pipeline? This cannot be undone.');
      if (!confirmed) return;

      await deletePipeline(button.dataset.pipelineId);
      await refreshAssetLists();

      alert('Pipeline deleted.');
    };
  });

  document.querySelectorAll('.asset-map-btn').forEach((button) => {
    button.onclick = () => {
      alert('Open the Map tab to view/edit this asset spatially.');
    };
  });
}

function renderMasterMeterList(masterMeters) {
  const list = document.getElementById('master-meter-list');
  if (!list) return;

  if (!masterMeters.length) {
    list.innerHTML = '<div class="module-empty">No master meters created yet.</div>';
    return;
  }

  list.innerHTML = `
    <div class="compact-list">
      ${masterMeters.map((meter) => `
        <div class="mini-card">
          <strong>${safe(meter.name)}</strong><br />
          <span>Meter: ${safe(meter.meter_number || '—')}</span><br />
          <small>
            DMA: ${safe(findDmaName(meter.dma_id))}
            • Flow: ${Math.round(Number(meter.monthly_flow_gal || 0)).toLocaleString()} gal
            • Pipe: ${safe(meter.pipe_size_in || '—')} in
          </small>

          <div style="margin-top:.55rem;">
            <span class="status-badge ${assetStatusClass(meter.status)}">
              ${safe(meter.status || 'Active')}
            </span>
          </div>
          <div class="button-row">
            <button
              class="btn-secondary asset-map-btn"
              type="button"
              data-type="master"
              data-lat="${safe(meter.lat || '')}"
              data-lon="${safe(meter.lon || '')}"
            >
              Open on Map
            </button>

            <button
              class="btn-secondary danger-btn delete-master-meter-btn"
              type="button"
              data-master-meter-id="${safe(meter.id)}"
            >
              Delete
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPipelineList(pipelines) {
  const list = document.getElementById('pipeline-list');
  if (!list) return;

  if (!pipelines.length) {
    list.innerHTML = '<div class="module-empty">No pipelines created yet.</div>';
    return;
  }

  list.innerHTML = `
    <div class="compact-list">
      ${pipelines.map((pipe) => `
        <div class="mini-card">
          <strong>${safe(pipe.name)}</strong><br />
          <span>
            ${safe(pipe.pipe_code || 'No code')}
            • ${safe(pipe.diameter_in || '—')} in
            • ${safe(pipe.material || '—')}
          </span><br />
          <small>
            DMA: ${safe(findDmaName(pipe.dma_id))}
            • Zone: ${safe(pipe.pressure_zone || '—')}
            • Installed: ${safe(pipe.install_year || '—')}
          </small>

          <div style="margin-top:.55rem;">
            <span class="status-badge ${assetStatusClass(pipe.status)}">
              ${safe(pipe.status || 'Active')}
            </span>
          </div>
          <div class="button-row">
              <button
                class="btn-secondary asset-map-btn"
                type="button"
                data-type="pipeline"
              >
                Open Map
              </button>

              <button
                class="btn-secondary danger-btn delete-pipeline-btn"
                type="button"
                data-pipeline-id="${safe(pipe.id)}"
              >
                Delete
              </button>
            </div>

        </div>
      `).join('')}
    </div>
  `;
}

function findDmaName(dmaId) {
  if (!dmaId) return 'Unassigned';

  const dma = dmas.find((item) => item.id === dmaId);
  return dma?.name || 'Unknown DMA';
}

function assetStatusClass(status = '') {
  if (['Active'].includes(status)) return 'status-ok';

  if ([
    'Needs Inspection',
    'Needs Calibration',
    'Estimated',
    'Leak Suspected',
    'Under Construction'
  ].includes(status)) {
    return 'status-warn';
  }

  if ([
    'Inactive',
    'Out of Service',
    'Abandoned',
    'Critical'
  ].includes(status)) {
    return 'status-bad';
  }

  return 'status-warn';
}

function clearMasterMeterForm() {
  [
    'master-meter-name',
    'master-meter-number',
    'master-meter-dma-id',
    'master-meter-lat',
    'master-meter-lon',
    'master-meter-pipe-size',
    'master-meter-inlet-pressure',
    'master-meter-outlet-pressure',
    'master-meter-monthly-flow'
  ].forEach(clearValue);

  setValue('master-meter-status', 'Active');
}

function clearPipelineForm() {
  [
    'pipeline-name',
    'pipeline-code',
    'pipeline-dma-id',
    'pipeline-diameter',
    'pipeline-material',
    'pipeline-install-year',
    'pipeline-pressure-zone',
    'pipeline-notes'
  ].forEach(clearValue);

  setValue('pipeline-status', 'Active');
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function clearValue(id) {
  const el = document.getElementById(id);
  if (el) el.value = '';
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function integerOrNull(value) {
  const n = Number.parseInt(value, 10);
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