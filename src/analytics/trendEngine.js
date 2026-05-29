export function analyzeCustomerUsageTrend(reads = []) {
  const clean = reads
    .map(normalizeRead)
    .filter((r) => r.period && Number.isFinite(r.usage))
    .sort((a, b) => a.period.localeCompare(b.period));

  if (!clean.length) {
    return emptyTrend();
  }

  const usages = clean.map((r) => r.usage);
  const latest = clean[clean.length - 1];
  const previous = clean[clean.length - 2] || null;

  const avg = average(usages);
  const min = Math.min(...usages);
  const max = Math.max(...usages);
  const std = standardDeviation(usages);

  const changeFromPrevious = previous
    ? percentChange(latest.usage, previous.usage)
    : null;

  const zScore = std > 0
    ? (latest.usage - avg) / std
    : 0;

  return {
    records: clean.length,
    latest_period: latest.period,
    latest_usage: latest.usage,
    previous_usage: previous?.usage ?? null,
    average_usage: avg,
    min_usage: min,
    max_usage: max,
    standard_deviation: std,
    change_from_previous_percent: changeFromPrevious,
    z_score: zScore,
    trend_direction: trendDirection(clean),
    risk_flags: usageRiskFlags({
      latest,
      previous,
      avg,
      std,
      zScore
    }),
    forecast_next_usage: forecastNextUsage(clean)
  };
}

export function analyzeUtilityUsageTrend(reads = []) {
  const grouped = groupByPeriod(reads);

  const periods = Object.entries(grouped)
    .map(([period, rows]) => {
      const usage = rows.reduce((sum, row) => sum + usageValue(row), 0);

      return {
        period,
        total_usage: usage,
        customer_count: new Set(rows.map((r) => r.customer_id || r.account_number)).size,
        read_count: rows.length
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  if (!periods.length) {
    return {
      records: 0,
      periods: [],
      total_usage: 0,
      average_period_usage: 0,
      trend_direction: 'No data',
      forecast_next_period_usage: 0
    };
  }

  const usageSeries = periods.map((p) => p.total_usage);

  return {
    records: reads.length,
    periods,
    total_usage: usageSeries.reduce((sum, value) => sum + value, 0),
    average_period_usage: average(usageSeries),
    min_period_usage: Math.min(...usageSeries),
    max_period_usage: Math.max(...usageSeries),
    trend_direction: trendDirection(
      periods.map((p) => ({
        period: p.period,
        usage: p.total_usage
      }))
    ),
    forecast_next_period_usage: forecastNextUsage(
      periods.map((p) => ({
        period: p.period,
        usage: p.total_usage
      }))
    )
  };
}

export function detectCustomerAnomalies(reads = []) {
  const grouped = groupByCustomer(reads);

  return Object.entries(grouped)
    .map(([customerKey, rows]) => {
      const trend = analyzeCustomerUsageTrend(rows);
      const latest = rows
        .map(normalizeRead)
        .sort((a, b) => a.period.localeCompare(b.period))
        .at(-1);

      return {
        customer_key: customerKey,
        customer_name: latest?.customer_name || '',
        meter_number: latest?.meter_number || '',
        latest_period: trend.latest_period,
        latest_usage: trend.latest_usage,
        average_usage: trend.average_usage,
        change_from_previous_percent: trend.change_from_previous_percent,
        risk_flags: trend.risk_flags,
        risk_score: scoreRisk(trend.risk_flags)
      };
    })
    .filter((item) => item.risk_score > 0)
    .sort((a, b) => b.risk_score - a.risk_score);
}

export function normalizeImportedUsageRows(rows = [], options = {}) {
  return rows.map((row) => {
    const previous = num(row.previous_read);
    const current = num(row.current_read);
    const multiplier = num(row.multiplier) || 1;
    const registerFactor = num(row.register_factor) || 1;

    const rawUsage =
      row.usage !== undefined && row.usage !== ''
        ? num(row.usage)
        : Math.max(current - previous, 0);

    const adjustedUsage = rawUsage * multiplier * registerFactor;

    return {
      ...row,
      previous_read: previous,
      current_read: current,
      multiplier,
      register_factor: registerFactor,
      raw_usage: rawUsage,
      usage: adjustedUsage,
      usage_unit: row.usage_unit || options.defaultUnit || 'CCF',
      period: row.period || row.billing_month || row.reading_date || ''
    };
  });
}

function normalizeRead(read = {}) {
  return {
    customer_id: read.customer_id,
    account_number: read.account_number || read.customers?.account_number,
    customer_name: read.customer_name || read.customers?.customer_name,
    meter_number: read.meter_number || read.customers?.meter_number,
    period: read.period || read.billing_month || read.reading_date || '',
    usage: usageValue(read)
  };
}

function usageValue(row = {}) {
  if (row.usage !== undefined) return num(row.usage);
  if (row.adjusted_usage !== undefined) return num(row.adjusted_usage);
  if (row.usage_gal !== undefined) return num(row.usage_gal);
  if (row.usage_ccf !== undefined) return num(row.usage_ccf);
  return 0;
}

function usageRiskFlags({ latest, previous, avg, std, zScore }) {
  const flags = [];

  if (latest.usage === 0) {
    flags.push('ZERO_USAGE');
  }

  if (previous && latest.usage < previous.usage * 0.25) {
    flags.push('SUDDEN_DROP');
  }

  if (previous && latest.usage > previous.usage * 2.5) {
    flags.push('SUDDEN_SPIKE');
  }

  if (avg > 0 && latest.usage < avg * 0.25) {
    flags.push('BELOW_HISTORICAL_AVERAGE');
  }

  if (avg > 0 && latest.usage > avg * 2.5) {
    flags.push('ABOVE_HISTORICAL_AVERAGE');
  }

  if (Math.abs(zScore) >= 2) {
    flags.push('STATISTICAL_OUTLIER');
  }

  if (std === 0 && latest.usage === avg && avg > 0) {
    flags.push('FLAT_USAGE_PATTERN');
  }

  return flags;
}

function scoreRisk(flags = []) {
  const weights = {
    ZERO_USAGE: 25,
    SUDDEN_DROP: 20,
    SUDDEN_SPIKE: 20,
    BELOW_HISTORICAL_AVERAGE: 15,
    ABOVE_HISTORICAL_AVERAGE: 15,
    STATISTICAL_OUTLIER: 25,
    FLAT_USAGE_PATTERN: 10
  };

  return flags.reduce((score, flag) => score + (weights[flag] || 5), 0);
}

function trendDirection(series = []) {
  if (series.length < 2) return 'Insufficient history';

  const first = series[0].usage;
  const last = series[series.length - 1].usage;

  const change = percentChange(last, first);

  if (change > 10) return 'Increasing';
  if (change < -10) return 'Decreasing';

  return 'Stable';
}

function forecastNextUsage(series = []) {
  if (!series.length) return 0;
  if (series.length < 3) return series[series.length - 1].usage;

  const recent = series.slice(-3).map((item) => item.usage);
  return average(recent);
}

function groupByPeriod(reads = []) {
  return reads.reduce((acc, row) => {
    const period = row.period || row.billing_month || row.reading_date || 'unknown';

    acc[period] ||= [];
    acc[period].push(row);

    return acc;
  }, {});
}

function groupByCustomer(reads = []) {
  return reads.reduce((acc, row) => {
    const key =
      row.customer_id ||
      row.account_number ||
      row.meter_number ||
      'unknown';

    acc[key] ||= [];
    acc[key].push(row);

    return acc;
  }, {});
}

function average(values = []) {
  if (!values.length) return 0;

  return values.reduce((sum, value) => sum + num(value), 0) / values.length;
}

function standardDeviation(values = []) {
  if (values.length < 2) return 0;

  const avg = average(values);

  const variance =
    values.reduce((sum, value) => {
      return sum + Math.pow(num(value) - avg, 2);
    }, 0) / values.length;

  return Math.sqrt(variance);
}

function percentChange(current, previous) {
  if (!previous) return null;

  return ((current - previous) / previous) * 100;
}

function emptyTrend() {
  return {
    records: 0,
    latest_period: '',
    latest_usage: 0,
    previous_usage: null,
    average_usage: 0,
    min_usage: 0,
    max_usage: 0,
    standard_deviation: 0,
    change_from_previous_percent: null,
    z_score: 0,
    trend_direction: 'No data',
    risk_flags: [],
    forecast_next_usage: 0
  };
}

function num(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}