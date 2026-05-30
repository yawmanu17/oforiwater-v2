import {
  normalizeImportedRead,
  normalizeProductionRow,
  summarizeImportedReads
} from './nrwImportEngine.js';

import {
  validateImportedReads,
  validateProductionRows
} from './importValidationEngine.js';

let importedRows = [];
let importedHeaders = [];
let normalizedReads = [];

export function initNrwImportUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);

  if (!root) return;

  root.innerHTML = `
    <section class="module-page">
      <div class="module-toolbar">
        <div class="module-title-block">
          <div class="module-eyebrow">NRW Data Intake</div>
          <h2>NRW Import Wizard</h2>
          <p>
            Upload billing, AMR, AMI, manual read, or production CSV files and apply meter multipliers.
          </p>
        </div>
      </div>

      <section class="module-panel">
        <div class="module-panel-header">
          <div>
            <h3 class="module-panel-title">Upload CSV</h3>
            <p class="module-panel-subtitle">
              Supports manual reads, AMR/AMI exports, billing exports, and production summaries.
            </p>
          </div>
        </div>

        <div class="form-grid">
          <label>Import Type
            <select id="nrw-import-type">
              <option value="reads">Customer Reads / Billing Usage</option>
              <option value="production">Production / Master Meter Volumes</option>
            </select>
          </label>

          <label>CSV File
            <input id="nrw-import-file" type="file" accept=".csv,text/csv" />
          </label>
        </div>

        <div class="button-row">
          <button id="parse-nrw-csv-btn" class="btn-primary" type="button">
            Preview CSV
          </button>
        </div>
      </section>

      <section class="module-panel">
        <div class="module-panel-header">
          <div>
            <h3 class="module-panel-title">Column Mapping</h3>
            <p class="module-panel-subtitle">
              Map CSV columns to OFORI fields. Meter Multiplier and Register Factor are optional.
            </p>
          </div>
        </div>

        <div id="nrw-column-mapping-root" class="form-grid">
          <div class="module-empty">Upload a CSV to map columns.</div>
        </div>

        <div class="button-row">
          <button id="normalize-nrw-import-btn" class="btn-primary" type="button">
            Apply Mapping & Calculate
          </button>
        </div>
      </section>

      <section class="module-panel">
        <div class="module-panel-header">
          <div>
            <h3 class="module-panel-title">Import Summary</h3>
            <p class="module-panel-subtitle">
              Review adjusted usage after multipliers and register factors are applied.
            </p>
          </div>
        </div>

        <div id="nrw-import-summary-root">
          <div class="module-empty">No import calculated yet.</div>
        </div>
      </section>

      <section class="module-panel">
        <div class="module-panel-header">
          <div>
            <h3 class="module-panel-title">Preview Rows</h3>
            <p class="module-panel-subtitle">
              First 10 rows from the uploaded CSV.
            </p>
          </div>
        </div>

        <div id="nrw-import-preview-root">
          <div class="module-empty">No rows uploaded yet.</div>
        </div>
      </section>
    </section>
  `;

  wireEvents();
}

function wireEvents() {
  document.getElementById('parse-nrw-csv-btn')?.addEventListener('click', parseCsvFile);

  document
    .getElementById('normalize-nrw-import-btn')
    ?.addEventListener('click', normalizeImport);
}

async function parseCsvFile() {
  const file = document.getElementById('nrw-import-file')?.files?.[0];

  if (!file) {
    alert('Please select a CSV file.');
    return;
  }

  const text = await file.text();
  const parsed = parseCsv(text);

  importedHeaders = parsed.headers;
  importedRows = parsed.rows;
  normalizedReads = [];

  renderMapping();
  renderPreview(importedRows);
}

function renderMapping() {
  const root = document.getElementById('nrw-column-mapping-root');
  const importType = val('nrw-import-type');

  if (!root) return;

  const fields =
    importType === 'production'
      ? productionMappingFields()
      : readMappingFields();

  root.innerHTML = fields.map((field) => `
    <label>${field.label}
      <select id="map-${field.key}">
        <option value="">-- Not mapped --</option>
        ${importedHeaders.map((header) => `
          <option value="${safe(header)}" ${guessSelected(header, field) ? 'selected' : ''}>
            ${safe(header)}
          </option>
        `).join('')}
      </select>
    </label>
  `).join('');
}

function normalizeImport() {
  if (!importedRows.length) {
    alert('Upload and preview a CSV first.');
    return;
  }

  const importType = val('nrw-import-type');
  const mapping = collectMapping(importType);

  if (importType === 'production') {
    const rows = importedRows.map((row) =>
      normalizeProductionRow(row, mapping)
    );

    renderProductionSummary(rows);
    window.OFORI_NRW_IMPORTED_PRODUCTION = rows.reduce(
  (sum, row) => sum + row.production_volume,
  0
);

window.OFORI_NRW_IMPORTED_PURCHASED = rows.reduce(
  (sum, row) => sum + row.purchased_water,
  0
);

window.OFORI_NRW_IMPORTED_EXPORTED = rows.reduce(
  (sum, row) => sum + row.exported_water,
  0
);
    return;
  }

  normalizedReads = importedRows.map((row) =>
  normalizeImportedRead(row, mapping)
);

const summary = summarizeImportedReads(normalizedReads);
const validation = validateImportedReads(normalizedReads);

window.OFORI_IMPORTED_USAGE_ROWS = normalizedReads;
window.OFORI_NRW_IMPORTED_READS = normalizedReads;
window.OFORI_NRW_IMPORTED_BILLED_USAGE = summary.total_adjusted_usage;

renderReadSummary(summary, normalizedReads, validation);
}

function collectMapping(importType) {
  const fields =
    importType === 'production'
      ? productionMappingFields()
      : readMappingFields();

  return fields.reduce((mapping, field) => {
    mapping[field.key] = val(`map-${field.key}`);
    return mapping;
  }, {});
}

function readMappingFields() {
  return [
    { key: 'account_number', label: 'Account Number', guesses: ['account', 'acct'] },
    { key: 'customer_name', label: 'Customer Name', guesses: ['customer', 'name'] },
    { key: 'meter_number', label: 'Meter Number', guesses: ['meter'] },
    { key: 'dma_code', label: 'DMA Code', guesses: ['dma'] },
    { key: 'billing_month', label: 'Billing Month / Period', guesses: ['billing', 'month', 'period'] },
    { key: 'previous_read', label: 'Previous Read', guesses: ['previous', 'prev'] },
    { key: 'current_read', label: 'Current Read', guesses: ['current', 'present'] },
    { key: 'usage_unit', label: 'Usage Unit', guesses: ['unit'] },
    { key: 'multiplier', label: 'Meter Multiplier', guesses: ['multiplier', 'mult'] },
    { key: 'register_factor', label: 'Register Factor', guesses: ['factor', 'register'] }
  ];
}

function productionMappingFields() {
  return [
    { key: 'source_name', label: 'Source / Meter Name', guesses: ['source', 'meter', 'plant'] },
    { key: 'period', label: 'Period / Month', guesses: ['period', 'month', 'date'] },
    { key: 'production', label: 'Production Volume', guesses: ['production', 'produced'] },
    { key: 'purchased_water', label: 'Purchased Water', guesses: ['purchased'] },
    { key: 'exported_water', label: 'Exported Water', guesses: ['exported'] },
    { key: 'multiplier', label: 'Volume Multiplier', guesses: ['multiplier', 'mult'] }
  ];
}

function renderReadSummary(summary, rows, validation) {
  const root = document.getElementById('nrw-import-summary-root');

  if (!root) return;

  root.innerHTML = `
    <div class="module-kpis">
      ${metricCard('Records', summary.records)}
      ${metricCard('Multiplied Records', summary.multiplied_records)}
      ${metricCard('Raw Usage', formatNumber(summary.total_raw_usage))}
      ${metricCard('Adjusted Usage', formatNumber(summary.total_adjusted_usage))}
    </div>

    <section class="module-panel" style="margin-top:1rem;">
      <h3 class="module-panel-title">Multiplier Formula</h3>
      <p>
        Adjusted Usage = (Current Read - Previous Read) × Meter Multiplier × Register Factor
      </p>
    </section>

    ${previewNormalizedRows(rows)}
    ${validationHtml(validation)}
  `;
}

function renderProductionSummary(rows) {
  const root = document.getElementById('nrw-import-summary-root');

  if (!root) return;

  const totals = rows.reduce(
    (sum, row) => {
      sum.production += row.production_volume;
      sum.purchased += row.purchased_water;
      sum.exported += row.exported_water;
      return sum;
    },
    { production: 0, purchased: 0, exported: 0 }
  );

  const validation = validateProductionRows(rows);
  renderProductionSummary(rows, validation);

  root.innerHTML = `
    <div class="module-kpis">
      ${metricCard('Production', formatNumber(totals.production))}
      ${metricCard('Purchased Water', formatNumber(totals.purchased))}
      ${metricCard('Exported Water', formatNumber(totals.exported))}
      ${metricCard('System Input Volume', formatNumber(totals.production + totals.purchased - totals.exported))}
    </div>
  `;
}

function validationHtml(validation) {
  if (!validation) return '';

  return `
    <section class="module-panel" style="margin-top:1rem;">
      <h3 class="module-panel-title">Import Data Quality</h3>

      <div class="module-kpis">
        ${metricCard('Quality Score', `${validation.score}%`)}
        ${metricCard('Ready for NRW', validation.readiness.nrw ? 'Yes' : 'No')}
        ${metricCard('Ready for Trends', validation.readiness.trend ? 'Yes' : 'No')}
        ${metricCard('Ready for DMA', validation.readiness.dma ? 'Yes' : 'Partial / No')}
      </div>

      ${validation.issues.length ? `
        <div class="compact-list" style="margin-top:1rem;">
          ${validation.issues.slice(0, 15).map((item) => `
            <div class="mini-card">
              <strong>Row ${item.rowNumber}</strong><br />
              <small>${safe(item.severity.toUpperCase())}: ${safe(item.message)}</small>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="module-empty">
          No major issues detected.
        </div>
      `}
    </section>
  `;
}

function renderPreview(rows) {
  const root = document.getElementById('nrw-import-preview-root');

  if (!root) return;

  if (!rows.length) {
    root.innerHTML = `<div class="module-empty">No rows found.</div>`;
    return;
  }

  root.innerHTML = tableHtml(rows.slice(0, 10));
}

function previewNormalizedRows(rows) {
  if (!rows.length) return '';

  return `
    <div class="module-table-wrap" style="margin-top:1rem;">
      <table class="table-clean">
        <thead>
          <tr>
            <th>Account</th>
            <th>Customer</th>
            <th>Meter</th>
            <th>Previous</th>
            <th>Current</th>
            <th>Multiplier</th>
            <th>Register Factor</th>
            <th>Adjusted Usage</th>
          </tr>
        </thead>

        <tbody>
          ${rows.slice(0, 10).map((row) => `
            <tr>
              <td>${safe(row.account_number)}</td>
              <td>${safe(row.customer_name)}</td>
              <td>${safe(row.meter_number)}</td>
              <td>${formatNumber(row.previous_read)}</td>
              <td>${formatNumber(row.current_read)}</td>
              <td>${formatNumber(row.multiplier)}</td>
              <td>${formatNumber(row.register_factor)}</td>
              <td><strong>${formatNumber(row.adjusted_usage)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function tableHtml(rows) {
  const headers = Object.keys(rows[0] || {});

  return `
    <div class="module-table-wrap">
      <table class="table-clean">
        <thead>
          <tr>
            ${headers.map((header) => `<th>${safe(header)}</th>`).join('')}
          </tr>
        </thead>

        <tbody>
          ${rows.map((row) => `
            <tr>
              ${headers.map((header) => `<td>${safe(row[header])}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function metricCard(label, value) {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${safe(label)}</div>
      <div class="kpi-value">${safe(value)}</div>
    </div>
  `;
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headers = splitCsvLine(lines[0] || '');

  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);

    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });

  return { headers, rows };
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result;
}

function guessSelected(header, field) {
  const normalized = header.toLowerCase();

  return field.guesses.some((guess) =>
    normalized.includes(guess.toLowerCase())
  );
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
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