import { parseCsv } from '../utils/csv.js';

import {
  normalizeAssetRow,
  analyzeAssetImport,
  buildAssetRiskMatrix
} from './assetImportEngine.js';

import { showSuccess } from '../ui/toast.js';

export async function importAssetCsv(file) {
  const text = await file.text();

  const rows = parseCsv(text);

  const assets = rows.map(normalizeAssetRow);

  const quality = analyzeAssetImport(assets);

  const riskMatrix = buildAssetRiskMatrix(assets);

  window.OFORI_IMPORTED_ASSETS = assets;
  window.OFORI_ASSET_IMPORT_QUALITY = quality;
  window.OFORI_ASSET_RISK_MATRIX = riskMatrix;

  showSuccess(`${assets.length} assets imported.`);

  return {
    assets,
    quality,
    riskMatrix
  };
}