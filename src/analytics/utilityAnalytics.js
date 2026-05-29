import { forecastUsage } from './forecastEngine.js';

export function analyzeUtility(reads = []) {
  const monthlyUsage = {};

  reads.forEach(read => {
    const month =
      read.billing_month ||
      read.reading_date?.slice(0, 7);

    if (!month) return;

    monthlyUsage[month] =
      (monthlyUsage[month] || 0) +
      Number(read.usage_gal || 0);
  });

  const months =
    Object.keys(monthlyUsage).sort();

  const usageHistory =
    months.map(month => monthlyUsage[month]);

  const forecast =
    forecastUsage(usageHistory);

  return {
    months,
    usageHistory,
    forecastUsage: forecast.forecast,
    trend: forecast.trend
  };
}