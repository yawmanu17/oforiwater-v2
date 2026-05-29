export function calculateNrwMetrics(input = {}) {
  const production = num(input.production);
  const purchasedWater = num(input.purchased_water);
  const exportedWater = num(input.exported_water);

  const billedMetered = num(input.billed_metered);
  const billedUnmetered = num(input.billed_unmetered);
  const unbilledMetered = num(input.unbilled_metered);
  const unbilledUnmetered = num(input.unbilled_unmetered);

  const unauthorizedConsumption = num(input.unauthorized_consumption);
  const customerMeterInaccuracy = num(input.customer_meter_inaccuracy);
  const dataHandlingErrors = num(input.data_handling_errors);

  const serviceConnections = num(input.service_connections);
  const mainsLengthMiles = num(input.mains_length_miles);
  const avgPressurePsi = num(input.avg_pressure_psi);
  const variableProductionCost = num(input.variable_production_cost);
  const retailUnitCost = num(input.retail_unit_cost);

  const systemInputVolume =
    production + purchasedWater - exportedWater;

  const authorizedConsumption =
    billedMetered +
    billedUnmetered +
    unbilledMetered +
    unbilledUnmetered;

  const waterLosses =
    systemInputVolume - authorizedConsumption;

  const apparentLosses =
    unauthorizedConsumption +
    customerMeterInaccuracy +
    dataHandlingErrors;

  const realLosses =
    Math.max(waterLosses - apparentLosses, 0);

  const nonRevenueWater =
    waterLosses + unbilledMetered + unbilledUnmetered;

  const revenueWater =
    billedMetered + billedUnmetered;

  const nrwPercent =
    pct(nonRevenueWater, systemInputVolume);

  const apparentLossPercent =
    pct(apparentLosses, systemInputVolume);

  const realLossPercent =
    pct(realLosses, systemInputVolume);

  const revenueWaterPercent =
    pct(revenueWater, systemInputVolume);

  const realLossCost =
    realLosses * variableProductionCost;

  const apparentLossCost =
    apparentLosses * retailUnitCost;

  const totalLossCost =
    realLossCost + apparentLossCost;

  const realLossPerConnectionPerDay =
    serviceConnections > 0
      ? realLosses / serviceConnections / 365
      : null;

  const realLossPerMilePerDay =
    mainsLengthMiles > 0
      ? realLosses / mainsLengthMiles / 365
      : null;

  const realLossPerConnectionPerDayPerPsi =
    serviceConnections > 0 && avgPressurePsi > 0
      ? realLosses / serviceConnections / 365 / avgPressurePsi
      : null;

  const uarl = estimateUarl({
    serviceConnections,
    mainsLengthMiles,
    avgPressurePsi
  });

  const ili =
    uarl > 0
      ? realLosses / uarl
      : null;

  const crli = calculateCrli({
    realLossPerConnectionPerDay,
    realLossPerMilePerDay,
    serviceConnections,
    mainsLengthMiles
  });

  return {
    systemInputVolume,
    authorizedConsumption,
    revenueWater,
    waterLosses,
    nonRevenueWater,

    apparentLosses,
    realLosses,

    nrwPercent,
    apparentLossPercent,
    realLossPercent,
    revenueWaterPercent,

    realLossCost,
    apparentLossCost,
    totalLossCost,

    realLossPerConnectionPerDay,
    realLossPerMilePerDay,
    realLossPerConnectionPerDayPerPsi,

    uarl,
    ili,
    crli,

    performanceBand: classifyNrwPerformance({
      nrwPercent,
      ili,
      crli
    })
  };
}

function estimateUarl({
  serviceConnections,
  mainsLengthMiles,
  avgPressurePsi
}) {
  if (!serviceConnections || !mainsLengthMiles || !avgPressurePsi) {
    return null;
  }

  /*
    Simplified UARL estimate placeholder.
    Later we can refine with:
    - mains length
    - number of service connections
    - average service line length
    - average pressure
    - unit conversions

    For now, this keeps the app usable even when utilities have limited data.
  */

  const pressureFactor = avgPressurePsi / 70;

  return (
    (serviceConnections * 0.05) +
    (mainsLengthMiles * 500)
  ) * pressureFactor;
}

function calculateCrli({
  realLossPerConnectionPerDay,
  realLossPerMilePerDay,
  serviceConnections,
  mainsLengthMiles
}) {
  /*
    CRLI placeholder implementation:
    combines connection-based and network-length-based real loss indicators.

    This gives utilities a practical internal benchmark even when full ILI
    inputs are incomplete.
  */

  const hasConnectionMetric =
    realLossPerConnectionPerDay !== null &&
    Number.isFinite(realLossPerConnectionPerDay);

  const hasLengthMetric =
    realLossPerMilePerDay !== null &&
    Number.isFinite(realLossPerMilePerDay);

  if (!hasConnectionMetric && !hasLengthMetric) return null;

  const connectionScore = hasConnectionMetric
    ? realLossPerConnectionPerDay
    : null;

  const lengthScore = hasLengthMetric
    ? realLossPerMilePerDay / 100
    : null;

  if (connectionScore !== null && lengthScore !== null) {
    return (connectionScore + lengthScore) / 2;
  }

  return connectionScore ?? lengthScore;
}

function classifyNrwPerformance({ nrwPercent, ili, crli }) {
  if (ili !== null && ili <= 2) return 'Excellent leakage control';
  if (ili !== null && ili <= 4) return 'Good leakage control';
  if (ili !== null && ili <= 8) return 'Needs improvement';
  if (ili !== null && ili > 8) return 'Severe leakage concern';

  if (nrwPercent <= 10) return 'Strong NRW performance';
  if (nrwPercent <= 20) return 'Moderate NRW performance';
  if (nrwPercent <= 35) return 'High NRW concern';

  return 'Critical NRW concern';
}

function pct(part, whole) {
  if (!whole) return 0;
  return (part / whole) * 100;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}