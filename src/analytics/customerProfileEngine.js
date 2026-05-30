import { forecastUsage } from './forecastEngine.js';

export function buildCustomerConsumptionProfile({
  customer = {},
  reads = [],
  ratePerThousandGallons = 6,
  baseCharge = 15
} = {}) {
  const history = reads
    .map((read) => normalizeRead(read))
    .filter((read) => read.period)
    .sort((a, b) => a.period.localeCompare(b.period));

  const usageValues = history.map((item) => item.usage);
  const latest = history[history.length - 1] || null;

  const averageUsage = average(usageValues);
  const minUsage = usageValues.length ? Math.min(...usageValues) : 0;
  const maxUsage = usageValues.length ? Math.max(...usageValues) : 0;
  const stdDev = standardDeviation(usageValues);

  const forecast = forecastUsage(usageValues);

  const leakRisk = classifyLeakRisk({
    latestUsage: latest?.usage || 0,
    averageUsage,
    stdDev
  });

  const meterRisk = classifyMeterRisk(history);

  const revenue = estimateRevenue({
    usageGallons: latest?.usage || 0,
    ratePerThousandGallons,
    baseCharge
  });

  const forecastRevenue = estimateRevenue({
    usageGallons: forecast.forecast,
    ratePerThousandGallons,
    baseCharge
  });

  return {
    customer,
    records: history.length,
    history,

    latestPeriod: latest?.period || '',
    latestUsage: latest?.usage || 0,

    averageUsage,
    minUsage,
    maxUsage,
    standardDeviation: stdDev,

    forecastUsage: forecast.forecast,
    trend: forecast.trend,

    leakRisk,
    meterRisk,

    latestRevenue: revenue.total,
    forecastRevenue: forecastRevenue.total,

    recommendations: buildRecommendations({
      leakRisk,
      meterRisk,
      latestUsage: latest?.usage || 0,
      averageUsage,
      trend: forecast.trend
    })
  };
}

function normalizeRead(read = {}) {
  return {
    period:
      read.billing_month ||
      read.reading_date?.slice(0, 7) ||
      read.period ||
      '',

    usage:
      Number(
        read.usage_gal ??
        read.adjusted_usage ??
        read.usage ??
        0
      )
  };
}

function classifyLeakRisk({
  latestUsage,
  averageUsage,
  stdDev
}) {
  if (!averageUsage || !latestUsage) return 'Low';

  if (latestUsage > averageUsage * 2) return 'High';

  if (latestUsage > averageUsage * 1.5) return 'Moderate';

  if (stdDev > 0 && latestUsage > averageUsage + 2 * stdDev) {
    return 'High';
  }

  return 'Low';
}

function classifyMeterRisk(history = []) {
  if (history.length < 3) return 'Insufficient history';

  const recent = history.slice(-3);
  const zeroCount = recent.filter((item) => item.usage === 0).length;

  if (zeroCount >= 2) return 'Possible stuck meter / zero usage';

  const values = recent.map((item) => item.usage);
  const uniqueValues = new Set(values);

  if (uniqueValues.size === 1 && values[0] > 0) {
    return 'Flat usage pattern';
  }

  return 'Low';
}

function estimateRevenue({
  usageGallons,
  ratePerThousandGallons,
  baseCharge
}) {
  const usageRevenue =
    (Number(usageGallons || 0) / 1000) *
    Number(ratePerThousandGallons || 0);

  const total =
    usageRevenue +
    Number(baseCharge || 0);

  return {
    usageRevenue,
    baseCharge,
    total
  };
}

function buildRecommendations({
  leakRisk,
  meterRisk,
  latestUsage,
  averageUsage,
  trend
}) {
  const recommendations = [];

  if (leakRisk === 'High') {
    recommendations.push('Contact customer for possible leak investigation.');
    recommendations.push('Review irrigation, toilets, service line, and continuous usage indicators.');
  }

  if (leakRisk === 'Moderate') {
    recommendations.push('Monitor next billing cycle and notify customer of elevated usage.');
  }

  if (meterRisk !== 'Low' && meterRisk !== 'Insufficient history') {
    recommendations.push('Schedule meter inspection or meter test.');
  }

  if (trend === 'Increasing') {
    recommendations.push('Review seasonal usage, irrigation, occupancy change, or possible leak.');
  }

  if (latestUsage < averageUsage * 0.25 && averageUsage > 0) {
    recommendations.push('Review for possible under-registration, meter issue, or occupancy change.');
  }

  if (!recommendations.length) {
    recommendations.push('Usage appears within expected range based on available history.');
  }

  return recommendations;
}

function average(values = []) {
  if (!values.length) return 0;

  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function standardDeviation(values = []) {
  if (values.length < 2) return 0;

  const avg = average(values);

  const variance =
    values.reduce((sum, value) => {
      return sum + Math.pow(Number(value || 0) - avg, 2);
    }, 0) / values.length;

  return Math.sqrt(variance);
}