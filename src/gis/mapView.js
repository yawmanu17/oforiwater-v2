import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { authState } from '../auth/auth.js';
import { getCustomersByUtility, updateCustomer } from '../supabase/customers.js';
import { getDmasByUtility, updateDma } from '../supabase/dmas.js';
import {
  getMasterMetersByUtility,
  getPipelinesByUtility,
  createPipeline,
  updatePipeline,
  deletePipeline,
  updateMasterMeter,
  deleteMasterMeter
} from '../supabase/assets.js';
import { getMeterReadsByMonth } from '../supabase/meterReads.js';
import {
  buildNetworkModel,
  getNrwColor,
  formatGallons,
  formatPercent
} from './networkModel.js';

import { numberOrNull } from '../utils/calculations.js';

let map = null;
let activeRootId = 'dashboard-module-root';
let lastClickedCoordinate = null;

let drawingPipeline = false;
let pipelineDraftPoints = [];
let pipelineDraftLayer = null;
let drawingDmaBoundary = false;
let dmaBoundaryDraftPoints = [];
let dmaBoundaryDraftLayer = null;
let latestDmas = [];

let extendingPipeline = false;
let pipelineBeingExtended = null;



export async function initMapView(rootId = 'dashboard-module-root') {
  activeRootId = rootId;

  const root = document.getElementById(rootId);
  const utility = authState.utility;
  const billingMonth = new Date().toISOString().slice(0, 7);

  if (!root || !utility?.id) return;

  root.innerHTML = `
  <section class="app-workspace">
    <div class="gis-toolbar">
      <div class="gis-tool-group">
        <button class="gis-tab active" type="button">Network</button>
        <button class="gis-tab" type="button">Hydraulics</button>
        <button class="gis-tab" type="button">NRW</button>
        <button class="gis-tab" type="button">Pressure</button>
        <button class="gis-tab" type="button">Assets</button>
      </div>

      <div class="gis-tool-divider"></div>

      <div class="gis-tool-group">
        <button id="fit-map-btn" class="gis-tool-btn" type="button" title="Fit to Data">⌖</button>
        <button id="draw-pipeline-btn" class="gis-tool-btn primary" type="button" title="Draw Pipeline">╱</button>
        <button id="cancel-pipeline-btn" class="gis-tool-btn" type="button" title="Cancel Drawing">✕</button>
        <button id="draw-dma-boundary-btn" class="gis-tool-btn" type="button" title="Draw DMA Boundary">⬠</button>
        <button id="cancel-dma-boundary-btn" class="gis-tool-btn" type="button" title="Cancel Boundary">↺</button>
      </div>
    </div>

    <div class="workspace-canvas">
      <div class="workspace-main-panel">
        <div id="utility-map" class="utility-map"></div>
      </div>

      <aside id="map-editor-panel" class="workspace-inspector empty">
        <div class="workspace-inspector-header">
          <strong>GIS Inspector</strong>
        </div>

        <div class="workspace-inspector-body">
          <strong>Select a map item</strong>
          <p>Click a customer, DMA, pipeline, or meter to inspect and edit records.</p>
        </div>
      </aside>
    </div>

    <div class="workspace-bottom-panel">
      <div class="workspace-scroll">
        <div class="map-legend">
          <span class="chip"><span class="chip-dot" style="background:#0ea5b7"></span>Customers</span>
          <span class="chip"><span class="chip-dot" style="background:#16a34a"></span>Healthy DMA</span>
          <span class="chip"><span class="chip-dot" style="background:#f59e0b"></span>Moderate NRW</span>
          <span class="chip"><span class="chip-dot" style="background:#ef4444"></span>High NRW</span>
          <span class="chip"><span class="chip-dot" style="background:#8b5cf6"></span>Master Meters</span>
          <span class="chip"><span class="chip-dot" style="background:#1e3a8a"></span>Pipelines</span>
        </div>
      </div>
    </div>
  </section>
`;
  const [customers, dmas, masterMeters, pipelines, meterReads] = await Promise.all([
    getCustomersByUtility(utility.id),
    getDmasByUtility(utility.id),
    getMasterMetersByUtility(utility.id),
    getPipelinesByUtility(utility.id),
    getMeterReadsByMonth(utility.id, billingMonth)
  ]);

  latestDmas = dmas;

  const networkModel = buildNetworkModel({
    customers,
    dmas,
    masterMeters,
    pipelines,
    meterReads,
    billingMonth
  });

  renderMap(customers, dmas, masterMeters, pipelines, networkModel);

  document.getElementById('fit-map-btn')?.addEventListener('click', () => {
    fitMapToData(customers, dmas, masterMeters, pipelines);
  });

  document.getElementById('draw-pipeline-btn')?.addEventListener('click', startPipelineDrawing);
  document.getElementById('cancel-pipeline-btn')?.addEventListener('click', cancelPipelineDrawing);
  document.getElementById('draw-dma-boundary-btn')?.addEventListener('click', startDmaBoundaryDrawing);
document.getElementById('cancel-dma-boundary-btn')?.addEventListener('click', cancelDmaBoundaryDrawing);
}

function renderMap(customers, dmas, masterMeters, pipelines, networkModel) {
  if (map) {
    map.remove();
    map = null;
  }

  drawingPipeline = false;
  pipelineDraftPoints = [];
  pipelineDraftLayer = null;
  drawingDmaBoundary = false;
  dmaBoundaryDraftPoints = [];
  dmaBoundaryDraftLayer = null;

  map = L.map('utility-map', {
    zoomControl: true,
    doubleClickZoom: false
  }).setView([33.749, -84.388], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const customerLayer = L.layerGroup().addTo(map);
  const dmaLayer = L.layerGroup().addTo(map);
  const masterMeterLayer = L.layerGroup().addTo(map);
  const pipelineLayer = L.layerGroup().addTo(map);

  renderCustomers(customerLayer, customers);
  renderDmas(dmaLayer, networkModel.dmas);
  renderMasterMeters(masterMeterLayer, masterMeters);
  renderPipelines(pipelineLayer, pipelines);

  L.control.layers(
    null,
    {
      Customers: customerLayer,
      DMAs: dmaLayer,
      'Master Meters': masterMeterLayer,
      Pipelines: pipelineLayer
    },
    { collapsed: false }
  ).addTo(map);

  map.on('popupopen', () => {
    wirePopupActions(customers, dmas, pipelines, masterMeters);
  });

  map.on('click', async (event) => {
  if (drawingPipeline) {
    addPipelineDraftPoint(event.latlng);
    return;
  }

  if (drawingDmaBoundary) {
  addDmaBoundaryDraftPoint(event.latlng);
  return;
}

  if (extendingPipeline && pipelineBeingExtended) {
    await extendPipelineToPoint(event.latlng);
    return;
  }

  const { lat, lng } = event.latlng;

    lastClickedCoordinate = {
      lat: lat.toFixed(6),
      lon: lng.toFixed(6)
    };

    L.popup()
      .setLatLng([lat, lng])
      .setContent(`
        <strong>Map Coordinate</strong><br />
        Lat: ${lat.toFixed(6)}<br />
        Lon: ${lng.toFixed(6)}<br />

        <div style="margin-top:0.65rem;">
          <button
            class="btn-secondary copy-map-coord-btn"
            type="button"
            data-lat="${lat}"
            data-lon="${lng}"
          >
            Copy Coordinates
          </button>
        </div>
      `)
      .openOn(map);

    setTimeout(() => {
      wirePopupActions(customers, dmas, pipelines, masterMeters);
    }, 50);
  });

 map.on('dblclick', async () => {
  if (drawingPipeline) {
    if (pipelineDraftPoints.length < 2) {
      alert('Draw at least two points before finishing.');
      return;
    }

    await finishPipelineDrawing();
    return;
  }

  if (drawingDmaBoundary) {
    if (dmaBoundaryDraftPoints.length < 3) {
      alert('Draw at least three points to create a DMA boundary.');
      return;
    }

    await finishDmaBoundaryDrawing();
  }
});

  setTimeout(() => {
    map.invalidateSize();
    fitMapToData(customers, dmas, masterMeters, pipelines);
  }, 150);
}

function renderMasterMeterEditor(meter, dmas = []) {
  const panel = document.getElementById('map-editor-panel');
  if (!panel) return;

  panel.classList.remove('empty');

  panel.innerHTML = `
    <div class="module-eyebrow">Master Meter Inspector</div>
    <h3 class="panel-title">${safe(meter.name || 'Unnamed Master Meter')}</h3>
    <p class="panel-subtitle">
      ${safe(meter.meter_number || 'No meter number')} • ${safe(meter.status || 'Active')}
    </p>

    <div class="form-grid compact">
      <label>Name
        <input id="master-edit-name" value="${safe(meter.name || '')}" />
      </label>

      <label>Meter Number
        <input id="master-edit-meter-number" value="${safe(meter.meter_number || '')}" />
      </label>

      <label>DMA
        <select id="master-edit-dma-id">
          <option value="">Unassigned</option>
          ${dmas.map((dma) => `
            <option value="${safe(dma.id)}" ${meter.dma_id === dma.id ? 'selected' : ''}>
              ${safe(dma.name)}
            </option>
          `).join('')}
        </select>
      </label>

      <label>Monthly Flow (gal)
        <input id="master-edit-monthly-flow" type="number" step="1" value="${safe(meter.monthly_flow_gal || '')}" />
      </label>

      <label>Pipe Size (in)
        <input id="master-edit-pipe-size" type="number" step="0.01" value="${safe(meter.pipe_size_in || '')}" />
      </label>

      <label>Status
        <select id="master-edit-status">
          ${['Active', 'Inactive', 'Needs Calibration', 'Estimated', 'Out of Service'].map((item) => `
            <option value="${item}" ${meter.status === item ? 'selected' : ''}>${item}</option>
          `).join('')}
        </select>
      </label>

      <label>Latitude
        <input id="master-edit-lat" type="number" step="0.000001" value="${safe(meter.lat || '')}" />
      </label>

      <label>Longitude
        <input id="master-edit-lon" type="number" step="0.000001" value="${safe(meter.lon || '')}" />
      </label>
    </div>

    <label>Notes
      <textarea id="master-edit-notes" rows="4">${safe(meter.notes || '')}</textarea>
    </label>

    <div class="button-row">
      <button id="master-save-btn" class="btn-primary" type="button">
        Save Master Meter
      </button>

      <button id="master-delete-btn" class="btn-secondary danger-btn" type="button">
        Delete
      </button>
    </div>
  `;

  document.getElementById('master-save-btn')?.addEventListener('click', async () => {
    await saveMasterMeterFromEditor(meter.id);
  });

  document.getElementById('master-delete-btn')?.addEventListener('click', async () => {
    await deleteMasterMeterFromEditor(meter.id);
  });
}

async function saveMasterMeterFromEditor(meterId) {
  const payload = {
    name: getInputValue('master-edit-name'),
    meter_number: getInputValue('master-edit-meter-number'),
    dma_id: getInputValue('master-edit-dma-id') || null,
    monthly_flow_gal: numberOrNull(getInputValue('master-edit-monthly-flow')),
    pipe_size_in: numberOrNull(getInputValue('master-edit-pipe-size')),
    status: getInputValue('master-edit-status'),
    lat: numberOrNull(getInputValue('master-edit-lat')),
    lon: numberOrNull(getInputValue('master-edit-lon')),
    notes: getInputValue('master-edit-notes')
  };

  await updateMasterMeter(meterId, payload);

  alert('Master meter updated.');
  await initMapView(activeRootId);
}

async function deleteMasterMeterFromEditor(meterId) {
  const confirmed = confirm('Delete this master meter? This cannot be undone.');
  if (!confirmed) return;

  await deleteMasterMeter(meterId);

  alert('Master meter deleted.');
  await initMapView(activeRootId);
}

function renderCustomers(layer, customers) {
  customers.forEach((customer) => {
    const lat = Number(customer.meter_lat || customer.service_lat);
    const lon = Number(customer.meter_lon || customer.service_lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const marker = L.marker([lat, lon]).addTo(layer);

    marker.bindPopup(`
      <strong>${safe(customer.account_number)}</strong><br />
      ${safe(customer.customer_name || 'Unnamed Customer')}<br />
      Meter: ${safe(customer.meter_number || '—')}<br />
      Status: ${safe(customer.meter_location_status || '—')}<br />
      Address: ${safe(customer.service_address || '—')}

      <div style="margin-top:0.65rem;">
        <button
          class="btn-secondary map-open-customer-editor-btn"
          type="button"
          data-customer-id="${safe(customer.id)}"
        >
          Open Editor
        </button>
      </div>
    `);

    marker.on('dblclick', () => {
      renderCustomerEditor(customer, latestDmas);
    });
  });
}


function renderDmas(layer, dmaModels) {
  dmaModels.forEach((model) => {
    const dma = model.dma;
    const color = getNrwColor(model.health);

    const boundaryCoordinates = extractPolygonCoordinates(dma.boundary_geom);

    if (boundaryCoordinates.length) {
      L.polygon(boundaryCoordinates, {
        color,
        weight: 3,
        fillColor: color,
        fillOpacity: 0.12
      })
        .bindPopup(dmaPopupHtml(dma, model))
        .addTo(layer);
    }

    const lat = Number(dma.center_lat);
    const lon = Number(dma.center_lon);

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      L.circleMarker([lat, lon], {
        radius: 10,
        weight: 3,
        color,
        fillColor: color,
        fillOpacity: 0.45
      })
        .bindPopup(dmaPopupHtml(dma, model))
        .addTo(layer);
    }
  });
}

function dmaPopupHtml(dma, model) {
  return `
    <strong>${safe(dma.name)}</strong><br />
    Code: ${safe(dma.code || '—')}<br />
    Pressure Zone: ${safe(dma.pressure_zone || '—')}<br />
    Customers: ${model.customerCount}<br />
    Master Flow: ${formatGallons(model.masterFlowGal)}<br />
    Authorized Usage: ${formatGallons(model.authorizedGal)}<br />
    NRW: ${formatGallons(model.nrwGal)} (${formatPercent(model.nrwPercent)})

    <div style="margin-top:0.65rem;">
      <button
        class="btn-secondary map-edit-dma-btn"
        type="button"
        data-dma-id="${safe(dma.id)}"
      >
        Edit DMA Center
      </button>

      <button
        class="btn-secondary map-redraw-dma-boundary-btn"
        type="button"
        data-dma-id="${safe(dma.id)}"
      >
        Redraw Boundary
      </button>
    </div>
  `;
}

function renderMasterMeters(layer, masterMeters) {
  masterMeters.forEach((meter) => {
    const lat = Number(meter.lat);
    const lon = Number(meter.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    L.circleMarker([lat, lon], {
      radius: 11,
      weight: 4,
      fillOpacity: 0.55,
      color: '#8b5cf6',
      fillColor: '#8b5cf6'
    })
      .bindPopup(`
  <strong>${safe(meter.name)}</strong><br />
  Master Meter: ${safe(meter.meter_number || '—')}<br />
  Pipe Size: ${safe(meter.pipe_size_in || '—')} in<br />
  Monthly Flow: ${formatGallons(meter.monthly_flow_gal || 0)}<br />
  Status: ${safe(meter.status || 'Active')}

  <div style="margin-top:0.65rem;">
    <button
      class="btn-secondary map-open-master-meter-editor-btn"
      type="button"
      data-master-meter-id="${safe(meter.id)}"
    >
      Open Inspector
    </button>
  </div>
`)
      .addTo(layer);
  });
}

function renderPipelines(layer, pipelines) {
  pipelines.forEach((pipe) => {
    const coordinates = extractLineStringCoordinates(pipe.geom);

    if (!coordinates.length) return;

   const visibleLine = L.polyline(coordinates, {
  weight: getPipelineWeight(pipe),
  opacity: 0.9,
  color: getPipelineColor(pipe.status),
  dashArray: pipe.status === 'Inactive' ? '8 6' : null
}).addTo(layer);

const hitLine = L.polyline(coordinates, {
  weight: 18,
  opacity: 0,
  color: '#000000',
  interactive: true
}).addTo(layer);

const popupHtml = `
  <strong>${safe(pipe.name)}</strong><br />
  Code: ${safe(pipe.pipe_code || '—')}<br />
  Diameter: ${safe(pipe.diameter_in || '—')} in<br />
  Material: ${safe(pipe.material || '—')}<br />
  Pressure Zone: ${safe(pipe.pressure_zone || '—')}<br />
  Status: ${safe(pipe.status || 'Active')}

  <div style="margin-top:0.65rem;">
    <button
      class="btn-secondary map-open-pipeline-editor-btn"
      type="button"
      data-pipeline-id="${safe(pipe.id)}"
    >
      Open Inspector
    </button>
  </div>
`;

visibleLine.bindPopup(popupHtml);
hitLine.bindPopup(popupHtml);

visibleLine.on('click', () => {
  renderPipelineEditor(pipe, latestDmas);
});

hitLine.on('click', () => {
  renderPipelineEditor(pipe, latestDmas);
});

addPipelineDirectionArrow(layer, coordinates);
addPipelineEndpointNodes(layer, coordinates);
  });
}

function addPipelineDirectionArrow(layer, coordinates) {
  if (coordinates.length < 2) return;

  const midIndex = Math.floor(coordinates.length / 2);
  const point = coordinates[midIndex];

  L.marker(point, {
    interactive: false,
    icon: L.divIcon({
      className: 'pipeline-arrow-marker',
      html: '➜',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(layer);
}

function addPipelineEndpointNodes(layer, coordinates) {
  if (coordinates.length < 2) return;

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  [first, last].forEach((point) => {
    L.circleMarker(point, {
      radius: 5,
      color: '#0e7490',
      fillColor: '#ffffff',
      fillOpacity: 1,
      weight: 3,
      interactive: false
    }).addTo(layer);
  });
}

function wirePopupActions(customers, dmas, pipelines = [], masterMeters = []) {
 
 document.querySelectorAll('.map-open-customer-editor-btn').forEach((button) => {
  button.onclick = () => {
    const customer = customers.find((item) => item.id === button.dataset.customerId);

    if (customer) {
      renderCustomerEditor(customer, dmas);
    } else {
      alert('Customer record not found.');
    }
  };
});

  document.querySelectorAll('.map-redraw-dma-boundary-btn').forEach((button) => {
  button.onclick = () => {
    const dma = dmas.find((item) => item.id === button.dataset.dmaId);
    if (dma) startDmaBoundaryDrawing(dma.id);
  };
});

  document.querySelectorAll('.map-edit-dma-btn').forEach((button) => {
    button.onclick = () => {
      const dma = dmas.find((item) => item.id === button.dataset.dmaId);
      if (dma) openDmaCenterEditor(dma);
    };
  });

  document.querySelectorAll('.map-open-pipeline-editor-btn').forEach((button) => {
    button.onclick = () => {
      const pipeline = pipelines.find((item) => item.id === button.dataset.pipelineId);
      if (pipeline) renderPipelineEditor(pipeline, dmas);
    };
  });

  document.querySelectorAll('.map-open-master-meter-editor-btn').forEach((button) => {
    button.onclick = () => {
      const meter = masterMeters.find((item) => item.id === button.dataset.masterMeterId);
      if (meter) renderMasterMeterEditor(meter, dmas);
    };
  });

  document.querySelectorAll('.copy-map-coord-btn').forEach((button) => {
    button.onclick = async () => {
      const text = `${Number(button.dataset.lat).toFixed(6)}, ${Number(button.dataset.lon).toFixed(6)}`;

      try {
        await navigator.clipboard.writeText(text);
        alert('Coordinates copied.');
      } catch {
        alert(text);
      }
    };
  });
}

function renderPipelineEditor(pipeline, dmas = []) {
  const panel = document.getElementById('map-editor-panel');
  if (!panel) return;

  panel.classList.remove('empty');

  panel.innerHTML = `
    <div class="module-eyebrow">Pipeline Inspector</div>
    <h3 class="panel-title">${safe(pipeline.name || 'Unnamed Pipeline')}</h3>
    <p class="panel-subtitle">
      ${safe(pipeline.pipe_code || 'No code')} • ${safe(pipeline.status || 'Active')}
    </p>

    <div class="form-grid compact">
      <label>Pipeline Name
        <input id="pipe-edit-name" value="${safe(pipeline.name || '')}" />
      </label>

      <label>Pipeline Code
        <input id="pipe-edit-code" value="${safe(pipeline.pipe_code || '')}" />
      </label>

      <label>DMA
        <select id="pipe-edit-dma-id">
          <option value="">Unassigned</option>
          ${dmas.map((dma) => `
            <option value="${safe(dma.id)}" ${pipeline.dma_id === dma.id ? 'selected' : ''}>
              ${safe(dma.name)}
            </option>
          `).join('')}
        </select>
      </label>

      <label>Diameter (in)
        <input id="pipe-edit-diameter" type="number" step="0.01" value="${safe(pipeline.diameter_in || '')}" />
      </label>

      <label>Material
        <select id="pipe-edit-material">
          ${['PVC', 'Ductile Iron', 'Cast Iron', 'Steel', 'HDPE', 'Concrete', 'Unknown'].map((item) => `
            <option value="${item}" ${pipeline.material === item ? 'selected' : ''}>${item}</option>
          `).join('')}
        </select>
      </label>

      <label>Status
        <select id="pipe-edit-status">
          ${['Active', 'Inactive', 'Critical', 'Leak Suspected', 'Under Construction'].map((item) => `
            <option value="${item}" ${pipeline.status === item ? 'selected' : ''}>${item}</option>
          `).join('')}
        </select>
      </label>

      <label>Pressure Zone
        <input id="pipe-edit-pressure-zone" value="${safe(pipeline.pressure_zone || '')}" />
      </label>

      <label>Install Year
        <input id="pipe-edit-install-year" type="number" value="${safe(pipeline.install_year || '')}" />
      </label>
    </div>

    <label>Notes
      <textarea id="pipe-edit-notes" rows="4">${safe(pipeline.notes || '')}</textarea>
    </label>

    <div class="button-row">
  <button id="pipe-save-btn" class="btn-primary" type="button">
    Save Pipeline
  </button>

  <button id="pipe-extend-btn" class="btn-secondary" type="button">
    Extend Pipe
  </button>

  <button id="pipe-cancel-extend-btn" class="btn-secondary" type="button">
    Cancel Extend
  </button>

  <button id="pipe-delete-btn" class="btn-secondary danger-btn" type="button">
    Delete
  </button>
</div>
  `;

  document.getElementById('pipe-save-btn')?.addEventListener('click', async () => {
    await savePipelineFromEditor(pipeline.id);
  });

  document.getElementById('pipe-extend-btn')?.addEventListener('click', () => {
  startPipelineExtend(pipeline);
});

document.getElementById('pipe-cancel-extend-btn')?.addEventListener('click', () => {
  cancelPipelineExtend();
});

  document.getElementById('pipe-delete-btn')?.addEventListener('click', async () => {
    await deletePipelineFromEditor(pipeline.id);
  });
}

async function savePipelineFromEditor(pipelineId) {
  const payload = {
    name: getInputValue('pipe-edit-name'),
    pipe_code: getInputValue('pipe-edit-code'),
    dma_id: getInputValue('pipe-edit-dma-id') || null,
    diameter_in: numberOrNull(getInputValue('pipe-edit-diameter')),
    material: getInputValue('pipe-edit-material'),
    status: getInputValue('pipe-edit-status'),
    pressure_zone: getInputValue('pipe-edit-pressure-zone'),
    install_year: numberOrNull(getInputValue('pipe-edit-install-year')),
    notes: getInputValue('pipe-edit-notes')
  };

  await updatePipeline(pipelineId, payload);

  alert('Pipeline updated.');
  await initMapView(activeRootId);
}

async function deletePipelineFromEditor(pipelineId) {
  const confirmed = confirm('Delete this pipeline? This cannot be undone.');

  if (!confirmed) return;

  try {
    await deletePipeline(pipelineId);

    const panel = document.getElementById('map-editor-panel');
    if (panel) {
      panel.classList.add('empty');
      panel.innerHTML = `
        <div>
          <strong>Pipeline deleted</strong>
          <p>The selected pipeline has been removed from the map.</p>
        </div>
      `;
    }

    alert('Pipeline deleted.');
    await initMapView(activeRootId);
  } catch (error) {
    console.error('Pipeline delete failed:', error);
    alert(`Pipeline delete failed: ${error.message}`);
  }
}

function renderCustomerEditor(customer, dmas = []) {
  const panel = document.getElementById('map-editor-panel');
  if (!panel) return;

  panel.classList.remove('empty');

  panel.innerHTML = `
    <div class="module-eyebrow">Customer GIS Editor</div>
    <h3 class="panel-title">${safe(customer.account_number)} — ${safe(customer.customer_name || 'Unnamed')}</h3>
    <p class="panel-subtitle">${safe(customer.service_address || 'No service address')}</p>

    <div class="form-grid compact">
      <label>Customer Name
        <input id="map-edit-customer-name" value="${safe(customer.customer_name || '')}" />
      </label>

      <label>Customer Class
        <select id="map-edit-customer-class">
          ${['Residential', 'Commercial', 'Industrial', 'Municipal'].map((item) => `
            <option value="${item}" ${customer.customer_class === item ? 'selected' : ''}>${item}</option>
          `).join('')}
        </select>
      </label>

      <label>DMA
        <select id="map-edit-dma-id">
          <option value="">Unassigned</option>
          ${dmas.map((dma) => `
            <option value="${safe(dma.id)}" ${customer.dma_id === dma.id ? 'selected' : ''}>
              ${safe(dma.name)}
            </option>
          `).join('')}
        </select>
      </label>

      <label>Meter Number
        <input id="map-edit-meter-number" value="${safe(customer.meter_number || '')}" />
      </label>

      <label>Meter Latitude
        <input id="map-edit-meter-lat" type="number" step="0.000001" value="${safe(customer.meter_lat || customer.service_lat || '')}" />
      </label>

      <label>Meter Longitude
        <input id="map-edit-meter-lon" type="number" step="0.000001" value="${safe(customer.meter_lon || customer.service_lon || '')}" />
      </label>

      <label>Status
        <select id="map-edit-location-status">
          ${['Needs Verification', 'Address Geocoded', 'GPS Verified', 'Manually Corrected', 'Imported GPS'].map((item) => `
            <option value="${item}" ${customer.meter_location_status === item ? 'selected' : ''}>
              ${item}
            </option>
          `).join('')}
        </select>
      </label>

      <label>Phone
        <input id="map-edit-phone" value="${safe(customer.phone || '')}" />
      </label>
    </div>

    <label>Meter / Field Notes
      <textarea id="map-edit-location-note" rows="4">${safe(customer.meter_location_note || '')}</textarea>
    </label>

    <div class="button-row">
      <button id="map-save-customer-btn" class="btn-primary" type="button">
        Save Changes
      </button>

      <button id="map-use-clicked-coords-btn" class="btn-secondary" type="button">
        Use Last Clicked Coordinate
      </button>
    </div>
  `;

  document.getElementById('map-save-customer-btn')?.addEventListener('click', async () => {
    await saveCustomerFromMapEditor(customer.id);
  });

  document.getElementById('map-use-clicked-coords-btn')?.addEventListener('click', () => {
    if (!lastClickedCoordinate) {
      alert('Click a point on the map first.');
      return;
    }

    setInputValue('map-edit-meter-lat', lastClickedCoordinate.lat);
    setInputValue('map-edit-meter-lon', lastClickedCoordinate.lon);
    setInputValue('map-edit-location-status', 'Manually Corrected');
  });
}

function startPipelineDrawing() {
  setMapToolActive('draw-pipeline-btn');
  setMapMode('draw');
  if (!map) return;

  drawingPipeline = true;
  pipelineDraftPoints = [];

  if (pipelineDraftLayer) {
    pipelineDraftLayer.remove();
    pipelineDraftLayer = null;
  }

  alert('Draw Pipeline mode activated.\n\nClick the start point, add any bends, then double-click the endpoint to save.');
}

function startDmaBoundaryDrawing(existingDmaId = null) {
  setMapToolActive('draw-dma-boundary-btn');
  setMapMode('draw');
  
  if (!map) return;

  drawingDmaBoundary = true;
  drawingPipeline = false;
  extendingPipeline = false;

  dmaBoundaryDraftPoints = [];

  if (dmaBoundaryDraftLayer) {
    dmaBoundaryDraftLayer.remove();
    dmaBoundaryDraftLayer = null;
  }

  const dmaId = existingDmaId || chooseDmaId();

  if (!dmaId) {
    drawingDmaBoundary = false;
    return;
  }

  map._oforiBoundaryDmaId = dmaId;

  alert('DMA Boundary drawing started. Click around the DMA area. Double-click to save boundary.');
}

function addDmaBoundaryDraftPoint(latlng) {
  dmaBoundaryDraftPoints.push([latlng.lat, latlng.lng]);

  if (dmaBoundaryDraftLayer) {
    dmaBoundaryDraftLayer.remove();
  }

  dmaBoundaryDraftLayer = L.polygon(dmaBoundaryDraftPoints, {
    color: '#0e7490',
    weight: 3,
    fillColor: '#06b6d4',
    fillOpacity: 0.12,
    dashArray: '8,6'
  }).addTo(map);
}

function cancelDmaBoundaryDrawing() {
  setMapToolActive('');
  setMapMode('select');
 
  drawingDmaBoundary = false;
  dmaBoundaryDraftPoints = [];
  
  if (dmaBoundaryDraftLayer) {
    dmaBoundaryDraftLayer.remove();
    dmaBoundaryDraftLayer = null;
  }

  map._oforiBoundaryDmaId = null;
}

async function finishDmaBoundaryDrawing() {
  setMapToolActive('');
  setMapMode('select');
  const dmaId = map?._oforiBoundaryDmaId;

  if (!dmaId || dmaBoundaryDraftPoints.length < 3) {
    alert('Select a DMA and draw at least three points.');
    return;
  }

  const geom = {
    type: 'Polygon',
    coordinates: [
      dmaBoundaryDraftPoints.map(([lat, lon]) => [lon, lat])
    ]
  };

  await updateDma(dmaId, {
    boundary_geom: geom,
    center_lat: average(dmaBoundaryDraftPoints.map(([lat]) => lat)),
    center_lon: average(dmaBoundaryDraftPoints.map(([, lon]) => lon))
  });

  alert('DMA boundary saved.');

  drawingDmaBoundary = false;
  dmaBoundaryDraftPoints = [];

  if (dmaBoundaryDraftLayer) {
    dmaBoundaryDraftLayer.remove();
    dmaBoundaryDraftLayer = null;
  }

  map._oforiBoundaryDmaId = null;

  await initMapView(activeRootId);
}

function average(values = []) {
  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + Number(value || 0), 0) /
    values.length
  );
}

function setMapMode(mode) {
  const mapEl = document.getElementById('utility-map');
  if (!mapEl) return;

  mapEl.classList.remove('draw-mode', 'extend-mode', 'select-mode');

  if (mode === 'draw') mapEl.classList.add('draw-mode');
  if (mode === 'extend') mapEl.classList.add('extend-mode');
  if (mode === 'select') mapEl.classList.add('select-mode');
}

function setMapToolActive(activeButtonId = '') {
  [
    'fit-map-btn',
    'draw-pipeline-btn',
    'cancel-pipeline-btn',
    'draw-dma-boundary-btn',
    'cancel-dma-boundary-btn'
  ].forEach((id) => {
    document.getElementById(id)?.classList.remove('map-tool-active');
  });

  if (activeButtonId) {
    document.getElementById(activeButtonId)?.classList.add('map-tool-active');
  }
}

function addPipelineDraftPoint(latlng) {
  pipelineDraftPoints.push([latlng.lat, latlng.lng]);

  if (pipelineDraftLayer) {
    pipelineDraftLayer.remove();
  }

  pipelineDraftLayer = L.polyline(pipelineDraftPoints, {
    weight: 5,
    opacity: 0.85,
    color: '#0e7490',
    dashArray: '8,8'
  }).addTo(map);
}

function cancelPipelineDrawing() {
  setMapToolActive('');
  setMapMode('select');
  drawingPipeline = false;
  pipelineDraftPoints = [];

  if (pipelineDraftLayer) {
    pipelineDraftLayer.remove();
    pipelineDraftLayer = null;
  }
}

async function finishPipelineDrawing() {
  setMapToolActive('');
  setMapMode('select');
  const utility = authState.utility;

  if (!utility?.id || pipelineDraftPoints.length < 2) {
    alert('Draw at least two points.');
    return;
  }

  const name = prompt('Pipeline Name', 'New Pipeline');
  if (!name) return;

  const pipeCode = prompt('Pipeline Code', `PIPE-${Date.now()}`) || '';
  const diameter = prompt('Diameter (in)', '8') || '';
  const material = prompt('Material', 'PVC') || '';
  const dmaId = chooseDmaId();

  const geom = {
    type: 'LineString',
    coordinates: pipelineDraftPoints.map(([lat, lon]) => [lon, lat])
  };

  await createPipeline({
    utility_id: utility.id,
    dma_id: dmaId,
    name,
    pipe_code: pipeCode,
    diameter_in: numberOrNull(diameter),
    material,
    status: 'Active',
    geom
  });

  alert('Pipeline saved.');
  cancelPipelineDrawing();
  await initMapView(activeRootId);
}

function chooseDmaId() {
  if (!latestDmas.length) return null;

  const options = latestDmas
    .map((dma, index) => `${index + 1}. ${dma.name}`)
    .join('\n');

  const selected = prompt(`Assign pipeline to DMA:\n${options}\n\nEnter number or leave blank:`, '');
  const index = Number(selected) - 1;

  if (!Number.isInteger(index) || !latestDmas[index]) {
    return null;
  }

  return latestDmas[index].id;
}

async function saveCustomerFromMapEditor(customerId) {
  const payload = {
    customer_name: getInputValue('map-edit-customer-name'),
    customer_class: getInputValue('map-edit-customer-class'),
    dma_id: getInputValue('map-edit-dma-id') || null,
    meter_number: getInputValue('map-edit-meter-number'),
    meter_lat: numberOrNull(getInputValue('map-edit-meter-lat')),
    meter_lon: numberOrNull(getInputValue('map-edit-meter-lon')),
    meter_location_status: getInputValue('map-edit-location-status'),
    meter_location_note: getInputValue('map-edit-location-note'),
    phone: getInputValue('map-edit-phone')
  };

  await updateCustomer(customerId, payload);

  alert('Customer GIS record updated.');
  await initMapView(activeRootId);
}

async function openDmaCenterEditor(dma) {
  const lat = prompt('DMA Center Latitude', dma.center_lat || '');
  if (lat === null) return;

  const lon = prompt('DMA Center Longitude', dma.center_lon || '');
  if (lon === null) return;

  await updateDma(dma.id, {
    center_lat: numberOrNull(lat),
    center_lon: numberOrNull(lon)
  });

  alert('DMA center updated.');
  await initMapView(activeRootId);
}

function fitMapToData(customers = [], dmas = [], masterMeters = [], pipelines = []) {
  if (!map) return;

  const points = [];

  customers.forEach((customer) => {
    const lat = Number(customer.meter_lat || customer.service_lat);
    const lon = Number(customer.meter_lon || customer.service_lon);

    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lat, lon]);
  });

  dmas.forEach((dma) => {
    const lat = Number(dma.center_lat);
    const lon = Number(dma.center_lon);

    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lat, lon]);
  });

  masterMeters.forEach((meter) => {
    const lat = Number(meter.lat);
    const lon = Number(meter.lon);

    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lat, lon]);
  });

  pipelines.forEach((pipe) => {
    extractLineStringCoordinates(pipe.geom).forEach((point) => points.push(point));
  });

  if (!points.length) return;

  map.fitBounds(points, {
    padding: [40, 40],
    maxZoom: 15
  });
}

function extractLineStringCoordinates(geom) {
  if (!geom) return [];

  if (typeof geom === 'string') {
    try {
      geom = JSON.parse(geom);
    } catch {
      return [];
    }
  }

  if (geom.type !== 'LineString' || !Array.isArray(geom.coordinates)) return [];

  return geom.coordinates
    .map(([lon, lat]) => [Number(lat), Number(lon)])
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
}

function extractPolygonCoordinates(geom) {
  if (!geom) return [];

  if (typeof geom === 'string') {
    try {
      geom = JSON.parse(geom);
    } catch {
      return [];
    }
  }

  if (geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return [];

  const ring = geom.coordinates[0];

  if (!Array.isArray(ring)) return [];

  return ring
    .map(([lon, lat]) => [Number(lat), Number(lon)])
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
}

function getPipelineColor(status) {
  if (status === 'Critical') return '#ef4444';
  if (status === 'Leak Suspected') return '#f59e0b';
  if (status === 'Inactive') return '#64748b';
  if (status === 'Under Construction') return '#8b5cf6';

  return '#0e7490';
}

function getPipelineWeight(pipe) {
  const diameter = Number(pipe.diameter_in || 0);

  if (diameter >= 24) return 8;
  if (diameter >= 12) return 6;
  if (diameter >= 6) return 5;

  return 3;
}

function getInputValue(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function startPipelineExtend(pipeline) {
  setMapMode('extend');
  if (!map) return;

  extendingPipeline = true;
  drawingPipeline = false;
  pipelineBeingExtended = pipeline;

  const coordinates = extractLineStringCoordinates(pipeline.geom);

  if (pipelineDraftLayer) {
    pipelineDraftLayer.remove();
    pipelineDraftLayer = null;
  }

  if (coordinates.length) {
    pipelineDraftLayer = L.polyline(coordinates, {
      weight: 7,
      opacity: 0.95,
      color: '#0e7490',
      dashArray: '10,6'
    }).addTo(map);

    map.fitBounds(coordinates, {
      padding: [40, 40],
      maxZoom: 17
    });
  }

  alert('Extend Pipe mode activated.\n\nClick the new endpoint on the map to extend this pipeline.');
}

function cancelPipelineExtend() {
  extendingPipeline = false;
  pipelineBeingExtended = null;
  setMapMode('select');

  if (pipelineDraftLayer) {
    pipelineDraftLayer.remove();
    pipelineDraftLayer = null;
  }

  alert('Pipe extension cancelled.');
}

async function extendPipelineToPoint(latlng) {
  if (!pipelineBeingExtended) return;

  setMapMode('select');
  const coordinates = extractLineStringCoordinates(pipelineBeingExtended.geom);

  if (!coordinates.length) {
    alert('This pipeline has no geometry to extend.');
    cancelPipelineExtend();
    return;

  }

  const newCoordinates = [
    ...coordinates,
    [latlng.lat, latlng.lng]
  ];

  const geom = {
    type: 'LineString',
    coordinates: newCoordinates.map(([lat, lon]) => [lon, lat])
  };

  await updatePipeline(pipelineBeingExtended.id, {
    geom
  });

  alert('Pipeline extended.');

  extendingPipeline = false;
  pipelineBeingExtended = null;

  if (pipelineDraftLayer) {
    pipelineDraftLayer.remove();
    pipelineDraftLayer = null;
  }

  await initMapView(activeRootId);
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
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