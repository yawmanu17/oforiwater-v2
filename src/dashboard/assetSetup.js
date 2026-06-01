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
import { getCurrentGpsPosition } from '../gis/geocode.js';
import { showSuccess, showError, showWarning } from '../ui/toast.js';

let dmas = [];

export async function initAssetSetup(rootId = 'dashboard-module-root') {
  requireTabAccess('assets');

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
      <h2>Asset Management</h2>
      <p>
        Manage master meters and pipelines for GIS mapping, NRW analysis,
        DMA performance, asset risk, and capital planning.
      </p>

      <div class="button-row asset-tabs">
        <button class="btn-primary asset-tab-btn" data-section="master" type="button">
          Master Meters
        </button>

        <button class="btn-secondary asset-tab-btn" data-section="pipeline" type="button">
          Pipelines
        </button>

        <button class="btn-secondary asset-tab-btn" data-section="inventory" type="button">
          Saved Assets
        </button>
      </div>
    </section>

    <section id="asset-section-master" class="asset-section card section-card">
      <h2>Master Meter Setup</h2>
      <p>Add DMA master meters for NRW, production-flow, and water balance analysis.</p>

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

        <label>Condition Score, 1 good - 5 poor
          <input id="master-meter-condition-score" type="number" min="1" max="5" step="1" value="3" />
        </label>

        <label>Criticality Score, 1 low - 5 high
          <input id="master-meter-criticality-score" type="number" min="1" max="5" step="1" value="3" />
        </label>

        <label>Replacement Cost, $
          <input id="master-meter-replacement-cost" type="number" step="1" />
        </label>

        <label>Status
          <select id="master-meter-status">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Needs Inspection">Needs Inspection</option>
            <option value="Needs Calibration">Needs Calibration</option>
            <option value="Out of Service">Out of Service</option>
          </select>
        </label>
      </div>

      <div class="button-row">
        <button id="capture-master-meter-gps-btn" class="btn-secondary" type="button">
          Capture GPS
        </button>

        <button id="save-master-meter-btn" class="btn-primary" type="button">
          Save Master Meter
        </button>

        <button id="clear-master-meter-btn" class="btn-secondary" type="button">
          Clear
        </button>
      </div>
    </section>

    <section id="asset-section-pipeline" class="asset-section card section-card" hidden>
      <h2>Pipeline Setup</h2>
      <p>
        Add pipeline records for GIS network visualization, asset risk,
        and capital planning. Geometry is drawn from the Map tab.
      </p>

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
          <select id="pipeline-material">
            <option value="">Select Material</option>
            <option value="PVC">PVC</option>
            <option value="Ductile Iron">Ductile Iron</option>
            <option value="Cast Iron">Cast Iron</option>
            <option value="Steel">Steel</option>
            <option value="HDPE">HDPE</option>
            <option value="Concrete">Concrete</option>
            <option value="Unknown">Unknown</option>
          </select>
        </label>

        <label>Install Year
          <input id="pipeline-install-year" type="number" placeholder="2020" />
        </label>

        <label>Pressure Zone
          <input id="pipeline-pressure-zone" placeholder="Zone 1" />
        </label>

        <label>Condition Score, 1 good - 5 poor
          <input id="pipeline-condition-score" type="number" min="1" max="5" step="1" value="3" />
        </label>

        <label>Criticality Score, 1 low - 5 high
          <input id="pipeline-criticality-score" type="number" min="1" max="5" step="1" value="3" />
        </label>

        <label>Replacement Cost, $
          <input id="pipeline-replacement-cost" type="number" step="1" />
        </label>

        <label>Status
          <select id="pipeline-status">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Needs Inspection">Needs Inspection</option>
            <option value="Leak Suspected">Leak Suspected</option>
            <option value="Critical">Critical</option>
            <option value="Abandoned">Abandoned</option>
          </select>
        </label>
      </div>

      <label>Notes
        <textarea id="pipeline-notes" rows="3" placeholder="Pipeline notes"></textarea>
      </label>

      <div class="button-row">
        <button id="save-pipeline-btn" class="btn-primary" type="button">
          Save Pipeline
        </button>

        <button id="clear-pipeline-btn" class="btn-secondary" type="button">
          Clear
        </button>
      </div>
    </section>

    <section id="asset-section-inventory" class="asset-section module-panel" hidden>
      <div class="module-panel-header">
        <div>
          <h3 class="module-panel-title">Saved Infrastructure Assets</h3>
          <p class="module-panel-subtitle">
            Master meters feed NRW calculations. Pipelines support GIS network visualization,
            leak risk analysis, and capital prioritization.
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

function wireEvents() {
  wireAssetTabs();

  document
    .getElementById('capture-master-meter-gps-btn')
    ?.addEventListener('click', async (event) => {
      setActiveActionButton(event.currentTarget);
      await captureMasterMeterGps();
    });

  document
    .getElementById('save-master-meter-btn')
    ?.addEventListener('click', async (event) => {
      setActiveActionButton(event.currentTarget);
      await saveMasterMeter();
    });

  document
    .getElementById('clear-master-meter-btn')
    ?.addEventListener('click', (event) => {
      setActiveActionButton(event.currentTarget);
      clearMasterMeterForm();
    });

  document
    .getElementById('save-pipeline-btn')
    ?.addEventListener('click', async (event) => {
      setActiveActionButton(event.currentTarget);
      await savePipeline();
    });

  document
    .getElementById('clear-pipeline-btn')
    ?.addEventListener('click', (event) => {
      setActiveActionButton(event.currentTarget);
      clearPipelineForm();
    });
}

function wireAssetTabs() {
  document.querySelectorAll('.asset-tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;

      document.querySelectorAll('.asset-section').forEach((panel) => {
        panel.hidden = panel.id !== `asset-section-${section}`;
      });

      document.querySelectorAll('.asset-tab-btn').forEach((btn) => {
        const active = btn.dataset.section === section;
        btn.classList.toggle('btn-primary', active);
        btn.classList.toggle('btn-secondary', !active);
      });
    });
  });
}

async function captureMasterMeterGps() {
  try {
    const gps = await getCurrentGpsPosition();

    setValue('master-meter-lat', gps.lat);
    setValue('master-meter-lon', gps.lon);

    showSuccess(`GPS captured. Accuracy: ${Math.round(gps.accuracy)} meters`);
  } catch (error) {
    showError(error.message || 'GPS capture failed.');
  }
}

async function saveMasterMeter() {
  const utility = authState.utility;

  if (!utility?.id) return;

  const conditionScore = numberOrNull(val('master-meter-condition-score')) || 3;
  const criticalityScore = numberOrNull(val('master-meter-criticality-score')) || 3;

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
    monthly_flow_gal: numberOrNull(val('master-meter-monthly-flow')) || 0,
    condition_score: conditionScore,
    criticality_score: criticalityScore,
    risk_score: conditionScore * criticalityScore,
    replacement_cost: numberOrNull(val('master-meter-replacement-cost')) || 0,
    status: val('master-meter-status') || 'Active'
  };

  if (!payload.name) {
    showWarning('Master meter name is required.');
    return;
  }

  await createMasterMeter(payload);

  clearMasterMeterForm();
  await refreshAssetLists();

  showSuccess('Master meter saved.');
}

async function savePipeline() {
  const utility = authState.utility;

  if (!utility?.id) return;

  const conditionScore = numberOrNull(val('pipeline-condition-score')) || 3;
  const criticalityScore = numberOrNull(val('pipeline-criticality-score')) || 3;

  const payload = {
    utility_id: utility.id,
    dma_id: val('pipeline-dma-id') || null,
    name: val('pipeline-name'),
    pipe_code: val('pipeline-code'),
    diameter_in: numberOrNull(val('pipeline-diameter')),
    material: val('pipeline-material'),
    install_year: integerOrNull(val('pipeline-install-year')),
    pressure_zone: val('pipeline-pressure-zone'),
    condition_score: conditionScore,
    criticality_score: criticalityScore,
    risk_score: conditionScore * criticalityScore,
    replacement_cost: numberOrNull(val('pipeline-replacement-cost')) || 0,
    status: val('pipeline-status') || 'Active',
    notes: val('pipeline-notes')
  };

  if (!payload.name) {
    showWarning('Pipeline name is required.');
    return;
  }

  await createPipeline(payload);

  clearPipelineForm();
  await refreshAssetLists();

  showSuccess('Pipeline saved.');
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

  const replacementValue =
    sumReplacement(masterMeters) +
    sumReplacement(pipelines);

  const highRisk =
    countHighRisk(masterMeters) +
    countHighRisk(pipelines);

  return `
    <div class="module-kpis">
      ${kpiCard('Total Assets', totalAssets)}
      ${kpiCard('Master Meters', masterMeters.length)}
      ${kpiCard('Pipelines', pipelines.length)}
      ${kpiCard('Active Assets', activeAssets)}
      ${kpiCard('Needs Review', needsReview)}
      ${kpiCard('High Risk', highRisk)}
      ${kpiCard('Replacement Value', `$${Math.round(replacementValue).toLocaleString()}`)}
      ${kpiCard('Master Flow', `${Math.round(masterFlowGal).toLocaleString()} gal`)}
    </div>
  `;
}

function renderMasterMeterList(masterMeters) {
  const list = document.getElementById('master-meter-list');
  if (!list) return;

  if (!masterMeters.length) {
    list.innerHTML = '<div class="module-empty">No master meters created yet.</div>';
    return;
  }

  list.innerHTML = `
    <div class="module-table-wrap">
      <table class="table-clean">
        <thead>
          <tr>
            <th>Name</th>
            <th>Meter #</th>
            <th>DMA</th>
            <th>Flow</th>
            <th>Risk</th>
            <th>Status</th>
            <th>Location</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${masterMeters.map((meter) => `
            <tr>
              <td><strong>${safe(meter.name)}</strong></td>
              <td>${safe(meter.meter_number || '—')}</td>
              <td>${safe(findDmaName(meter.dma_id))}</td>
              <td>${Math.round(Number(meter.monthly_flow_gal || 0)).toLocaleString()} gal</td>
              <td>${riskBadge(meter.risk_score)}</td>
              <td>
                <span class="status-badge ${assetStatusClass(meter.status)}">
                  ${safe(meter.status || 'Active')}
                </span>
              </td>
              <td>
                ${meter.lat && meter.lon
                  ? `${safe(meter.lat)}, ${safe(meter.lon)}`
                  : 'Needs GPS'}
              </td>
              <td>
                <div class="button-row">
                  <button class="btn-secondary asset-map-btn" type="button">
                    Open Map
                  </button>

                  <button
                    class="btn-secondary danger-btn delete-master-meter-btn"
                    type="button"
                    data-master-meter-id="${safe(meter.id)}"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
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
    <div class="module-table-wrap">
      <table class="table-clean">
        <thead>
          <tr>
            <th>Name</th>
            <th>Code</th>
            <th>DMA</th>
            <th>Size</th>
            <th>Material</th>
            <th>Risk</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${pipelines.map((pipe) => `
            <tr>
              <td><strong>${safe(pipe.name)}</strong></td>
              <td>${safe(pipe.pipe_code || '—')}</td>
              <td>${safe(findDmaName(pipe.dma_id))}</td>
              <td>${safe(pipe.diameter_in || '—')} in</td>
              <td>${safe(pipe.material || '—')}</td>
              <td>${riskBadge(pipe.risk_score)}</td>
              <td>
                <span class="status-badge ${assetStatusClass(pipe.status)}">
                  ${safe(pipe.status || 'Active')}
                </span>
              </td>
              <td>
                <div class="button-row">
                  <button class="btn-secondary asset-map-btn" type="button">
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
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function wireAssetListActions() {
  document.querySelectorAll('.delete-master-meter-btn').forEach((button) => {
    button.onclick = async () => {
      const confirmed = confirm('Delete this master meter? This cannot be undone.');
      if (!confirmed) return;

      await deleteMasterMeter(button.dataset.masterMeterId);
      await refreshAssetLists();

      showSuccess('Master meter deleted.');
    };
  });

  document.querySelectorAll('.delete-pipeline-btn').forEach((button) => {
    button.onclick = async () => {
      const confirmed = confirm('Delete this pipeline? This cannot be undone.');
      if (!confirmed) return;

      await deletePipeline(button.dataset.pipelineId);
      await refreshAssetLists();

      showSuccess('Pipeline deleted.');
    };
  });

  document.querySelectorAll('.asset-map-btn').forEach((button) => {
    button.onclick = () => {
      showSuccess('Open the Map tab to view or edit this asset spatially.');
    };
  });
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
    'master-meter-monthly-flow',
    'master-meter-replacement-cost'
  ].forEach(clearValue);

  setValue('master-meter-condition-score', '3');
  setValue('master-meter-criticality-score', '3');
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
    'pipeline-notes',
    'pipeline-replacement-cost'
  ].forEach(clearValue);

  setValue('pipeline-condition-score', '3');
  setValue('pipeline-criticality-score', '3');
  setValue('pipeline-status', 'Active');
}

function setActiveActionButton(activeButton) {
  const container = activeButton.closest('.button-row');
  if (!container) return;

  container.querySelectorAll('button').forEach((button) => {
    button.classList.remove('btn-primary');
    button.classList.add('btn-secondary');
  });

  activeButton.classList.remove('btn-secondary');
  activeButton.classList.add('btn-primary');
}

function kpiCard(label, value) {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${safe(label)}</div>
      <div class="kpi-value">${safe(value)}</div>
    </div>
  `;
}

function riskBadge(score) {
  const value = Number(score || 0);

  if (value >= 20) {
    return `<span class="status-badge status-bad">${value}</span>`;
  }

  if (value >= 12) {
    return `<span class="status-badge status-warn">${value}</span>`;
  }

  return `<span class="status-badge status-ok">${value || '—'}</span>`;
}

function sumReplacement(items = []) {
  return items.reduce(
    (sum, item) => sum + Number(item.replacement_cost || 0),
    0
  );
}

function countHighRisk(items = []) {
  return items.filter((item) => Number(item.risk_score || 0) >= 20).length;
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