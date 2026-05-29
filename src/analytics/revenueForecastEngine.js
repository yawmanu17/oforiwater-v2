export function forecastRevenue({
  forecastUsage = 0,
  ratePerThousandGallons = 0,
  baseCharge = 0,
  accountCount = 0
} = {}) {
  const usageRevenue =
    (Number(forecastUsage || 0) / 1000) *
    Number(ratePerThousandGallons || 0);

  const baseRevenue =
    Number(baseCharge || 0) *
    Number(accountCount || 0);

  return {
    usageRevenue,
    baseRevenue,
    totalForecastRevenue: usageRevenue + baseRevenue
  };
}