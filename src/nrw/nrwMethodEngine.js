export function analyzeNrwDataReadiness(input = {}, metrics = {}) {
  const available = {
    waterBalance:
      has(input.production) &&
      hasAny(input.billed_metered, input.billed_unmetered),

    apparentLoss:
      hasAny(
        input.unauthorized_consumption,
        input.customer_meter_inaccuracy,
        input.data_handling_errors
      ),

    ili:
      has(metrics.realLosses) &&
      has(input.service_connections) &&
      has(input.mains_length_miles) &&
      has(input.avg_pressure_psi),

    crli:
      has(metrics.realLosses) &&
      has(input.service_connections) &&
      has(input.mains_length_miles),

    gpdConnection:
      has(metrics.authorizedConsumption) &&
      has(input.service_connections),

    gpdPerson:
      has(metrics.authorizedConsumption) &&
      has(input.population_served),

    cost:
      hasAny(input.variable_production_cost, input.retail_unit_cost)
  };

  const methods = [];

  if (available.waterBalance) {
    methods.push({
      name: 'Water Balance Method',
      metric: 'NRW %, NRW Volume',
      confidence: available.apparentLoss ? 'High' : 'Medium',
      usedFor: 'Executive reporting, monthly utility benchmarking, production vs consumption analysis.'
    });
  }

  if (available.ili) {
    methods.push({
      name: 'ILI Benchmark Method',
      metric: 'Infrastructure Leakage Index',
      confidence: 'High',
      usedFor: 'Formal leakage benchmarking and real-loss performance evaluation.'
    });
  }

  if (available.crli) {
    methods.push({
      name: 'CRLI Real Loss Benchmark',
      metric: 'Combined Real Loss Index Estimate',
      confidence: available.ili ? 'High' : 'Medium',
      usedFor: 'Real-loss comparison when full ILI inputs are incomplete.'
    });
  }

  if (available.gpdConnection || available.gpdPerson) {
    methods.push({
      name: 'Normalized Demand Method',
      metric: 'GPD / Connection and GPD / Person',
      confidence: available.gpdPerson ? 'High' : 'Medium',
      usedFor: 'Demand normalization, abnormal consumption detection, and planning.'
    });
  }

  const missing = [];

  if (!has(input.production)) missing.push('Production volume');
  if (!hasAny(input.billed_metered, input.billed_unmetered)) missing.push('Billed consumption');
  if (!available.apparentLoss) missing.push('Apparent loss estimates');
  if (!has(input.service_connections)) missing.push('Service connections');
  if (!has(input.mains_length_miles)) missing.push('Mains length');
  if (!has(input.avg_pressure_psi)) missing.push('Average pressure');
  if (!has(input.population_served)) missing.push('Population served');

  return {
    available,
    methods,
    missing,
    recommendations: buildRecommendations(available, metrics)
  };
}

export function calculateNormalizedNrwMetrics(input = {}, metrics = {}) {
  const days = Number(input.days_in_period || 30);
  const population = Number(input.population_served || 0);
  const serviceConnections = Number(input.service_connections || 0);

  const authorizedGal = Number(metrics.authorizedConsumption || 0);
  const nrwGal = Number(metrics.nonRevenueWater || 0);
  const realLossGal = Number(metrics.realLosses || 0);

  return {
    gpdPerConnection:
      serviceConnections > 0 && days > 0
        ? authorizedGal / serviceConnections / days
        : null,

    gpdPerPerson:
      population > 0 && days > 0
        ? authorizedGal / population / days
        : null,

    nrwGpd:
      days > 0
        ? nrwGal / days
        : null,

    realLossGpd:
      days > 0
        ? realLossGal / days
        : null
  };
}

function buildRecommendations(available, metrics) {
  const recs = [];

  if (!available.apparentLoss) {
    recs.push('Add meter accuracy, theft/unauthorized use, and billing data error estimates to separate real losses from apparent losses.');
  }

  if (!available.ili && available.crli) {
    recs.push('CRLI can be used now. Add average pressure and service-line details later to improve ILI benchmarking.');
  }

  if (Number(metrics.nrwPercent || 0) > 25) {
    recs.push('Prioritize DMA leak survey, meter audit, and billing data validation.');
  }

  if (Number(metrics.apparentLossPercent || 0) > 5) {
    recs.push('Review customer meter age, zero-usage accounts, estimated reads, and manual entry errors.');
  }

  if (Number(metrics.realLossPercent || 0) > 15) {
    recs.push('Prioritize leak detection, pressure management, night-flow analysis, and main/service-line repair planning.');
  }

  return recs;
}

function has(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function hasAny(...values) {
  return values.some(has);
}