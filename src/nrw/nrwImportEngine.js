export function normalizeImportedRead(row = {}, mapping = {}) {
  const previousRead = num(row[mapping.previous_read]);
  const currentRead = num(row[mapping.current_read]);

  const multiplier = num(row[mapping.multiplier]) || 1;
  const registerFactor = num(row[mapping.register_factor]) || 1;

  const rawUsage = Math.max(currentRead - previousRead, 0);

  const adjustedUsage = rawUsage * multiplier * registerFactor;

  return {
    account_number: text(row[mapping.account_number]),
    customer_name: text(row[mapping.customer_name]),
    meter_number: text(row[mapping.meter_number]),
    dma_code: text(row[mapping.dma_code]),
    billing_month: text(row[mapping.billing_month]),

    previous_read: previousRead,
    current_read: currentRead,

    multiplier,
    register_factor: registerFactor,

    raw_usage: rawUsage,
    adjusted_usage: adjustedUsage,

    usage_unit: text(row[mapping.usage_unit]) || 'CCF'
  };
}

export function normalizeProductionRow(row = {}, mapping = {}) {
  const production = num(row[mapping.production]);
  const purchased = num(row[mapping.purchased_water]);
  const exported = num(row[mapping.exported_water]);
  const multiplier = num(row[mapping.multiplier]) || 1;

  return {
    source_name: text(row[mapping.source_name]),
    period: text(row[mapping.period]),
    production_volume: production * multiplier,
    purchased_water: purchased * multiplier,
    exported_water: exported * multiplier,
    multiplier
  };
}

export function summarizeImportedReads(rows = []) {
  return rows.reduce(
    (summary, row) => {
      summary.total_raw_usage += num(row.raw_usage);
      summary.total_adjusted_usage += num(row.adjusted_usage);
      summary.records += 1;

      if (num(row.multiplier) !== 1) {
        summary.multiplied_records += 1;
      }

      return summary;
    },
    {
      records: 0,
      multiplied_records: 0,
      total_raw_usage: 0,
      total_adjusted_usage: 0
    }
  );
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value) {
  return String(value ?? '').trim();
}