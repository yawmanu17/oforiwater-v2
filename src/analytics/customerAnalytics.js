import { forecastUsage } from './forecastEngine.js';

export function analyzeCustomer(customerReads = []) {
  const usageHistory = customerReads
    .map(read => Number(read.usage_ccf || read.usage_gal || 0))
    .filter(Number.isFinite);

  const forecast = forecastUsage(usageHistory);

  const average =
    usageHistory.length
      ? usageHistory.reduce((a, b) => a + b, 0) /
        usageHistory.length
      : 0;

  const latest =
    usageHistory[usageHistory.length - 1] || 0;

  return {
    averageUsage: average,
    latestUsage: latest,
    forecastUsage: forecast.forecast,
    trend: forecast.trend,
    leakRisk:
      latest > average * 1.5
        ? 'High'
        : latest > average * 1.25
          ? 'Moderate'
          : 'Low'
  };
}