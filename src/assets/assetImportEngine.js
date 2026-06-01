export function normalizeAssetRow(row = {}) {
  const assetId =
    text(row.asset_id) ||
    text(row.asset_number) ||
    text(row.id);

  const assetType =
    text(row.asset_type) ||
    text(row.type);

  const conditionScore =
    clamp(num(row.condition_score), 1, 5);

  const criticalityScore =
    clamp(num(row.criticality_score), 1, 5);

  const riskScore =
    conditionScore * criticalityScore;

  return {
    asset_id: assetId,
    asset_type: assetType,

    asset_name:
      text(row.asset_name) ||
      text(row.name),

    dma_code:
      text(row.dma_code),

    lat:
      num(row.lat),

    lon:
      num(row.lon),

    install_year:
      int(row.install_year),

    diameter_in:
      num(row.diameter_in),

    material:
      text(row.material),

    pressure_zone:
      text(row.pressure_zone),

    condition_score:
      conditionScore,

    criticality_score:
      criticalityScore,

    risk_score:
      riskScore,

    replacement_cost:
      num(row.replacement_cost),

    status:
      text(row.status) || 'Active',

    notes:
      text(row.notes)
  };
}

export function analyzeAssetImport(rows = []) {
  const result = {
    total_records: rows.length,
    missing_asset_id: 0,
    missing_asset_type: 0,
    missing_dma: 0,
    missing_gps: 0,
    missing_install_year: 0,
    missing_material: 0,
    missing_condition: 0,
    duplicate_asset_ids: 0,
    quality_score: 100
  };

  const ids = new Set();

  rows.forEach((row) => {
    if (!row.asset_id) {
      result.missing_asset_id += 1;
    }

    if (!row.asset_type) {
      result.missing_asset_type += 1;
    }

    if (!row.dma_code) {
      result.missing_dma += 1;
    }

    if (!row.lat || !row.lon) {
      result.missing_gps += 1;
    }

    if (!row.install_year) {
      result.missing_install_year += 1;
    }

    if (!row.material) {
      result.missing_material += 1;
    }

    if (!row.condition_score) {
      result.missing_condition += 1;
    }

    if (row.asset_id) {
      if (ids.has(row.asset_id)) {
        result.duplicate_asset_ids += 1;
      }

      ids.add(row.asset_id);
    }
  });

  const penalties =
    result.missing_asset_id +
    result.missing_asset_type +
    result.missing_dma +
    result.missing_gps +
    result.missing_install_year +
    result.missing_material +
    result.missing_condition +
    result.duplicate_asset_ids;

  result.quality_score = Math.max(
    0,
    Math.round(
      100 -
      (penalties / Math.max(rows.length, 1)) * 10
    )
  );

  return result;
}

export function buildAssetRiskMatrix(rows = []) {
  return rows.map((row) => ({
    asset_id: row.asset_id,
    asset_name: row.asset_name,
    asset_type: row.asset_type,

    risk_score:
      Number(row.risk_score || 0),

    replacement_cost:
      Number(row.replacement_cost || 0),

    priority:
      determinePriority(row.risk_score)
  }));
}

function determinePriority(score) {
  const value = Number(score || 0);

  if (value >= 20) return 'Immediate';
  if (value >= 12) return 'High';
  if (value >= 6) return 'Medium';

  return 'Low';
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function int(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  return String(value ?? '').trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value || 3));
}