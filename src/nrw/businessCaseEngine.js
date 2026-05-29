export function buildBusinessCase(metrics = {}) {
  const nrwVolume =
    Number(metrics.nonRevenueWater || 0);

  const apparentLosses =
    Number(metrics.apparentLosses || 0);

  const realLosses =
    Number(metrics.realLosses || 0);

  const productionCost =
    Number(metrics.variableProductionCost || 0);

  const retailRate =
    Number(metrics.retailUnitCost || 0);

  const realLossCost =
    realLosses * productionCost;

  const apparentLossRevenueRisk =
    apparentLosses * retailRate;

  const totalAnnualImpact =
    realLossCost +
    apparentLossRevenueRisk;

  return {
    nrwVolume,

    realLossCost,

    apparentLossRevenueRisk,

    totalAnnualImpact,

    priority:
      determinePriority(metrics),

    strategy:
      recommendedStrategy(metrics),

    payback:
      estimatePayback(
        totalAnnualImpact
      )
  };
}

function determinePriority(metrics) {
  const nrw =
    Number(metrics.nrwPercent || 0);

  if (nrw >= 30) return 'Critical';
  if (nrw >= 20) return 'High';
  if (nrw >= 10) return 'Moderate';

  return 'Low';
}

function estimatePayback(lossCost) {
  if (lossCost <= 0) {
    return 'Insufficient data';
  }

  if (lossCost > 500000) {
    return '< 2 years';
  }

  if (lossCost > 250000) {
    return '2 - 4 years';
  }

  return '4+ years';
}

function recommendedStrategy(metrics) {
  const apparent =
    Number(metrics.apparentLosses || 0);

  const real =
    Number(metrics.realLosses || 0);

  if (real > apparent) {
    return [
      'DMA leak surveys',
      'Pressure management',
      'Leak detection program',
      'Asset replacement planning'
    ];
  }

  return [
    'Meter testing',
    'AMI deployment',
    'Billing validation',
    'Unauthorized use investigation'
  ];
}