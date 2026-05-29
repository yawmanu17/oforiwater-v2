export function prioritizeDmas(models = [], options = {}) {
  const productionCost = Number(options.productionCost || 0);
  const retailRate = Number(options.retailRate || 0);
  const monthsPerYear = Number(options.monthsPerYear || 12);

  return models
    .map((item) => {
      const nrwGal = Number(item.nrwGal || 0);
      const nrwPercent = Number(item.nrwPercent || 0);

      const monthlyLossCost = nrwGal * productionCost;
      const annualLossCost = monthlyLossCost * monthsPerYear;

      const potentialRevenueRisk = nrwGal * retailRate * monthsPerYear;

      const priorityScore =
        nrwPercent * 0.45 +
        normalizeCost(annualLossCost) * 0.35 +
        normalizeVolume(nrwGal) * 0.2;

      return {
        ...item,
        monthlyLossCost,
        annualLossCost,
        potentialRevenueRisk,
        priorityScore,
        priorityLevel: classifyPriority(priorityScore, nrwPercent),
        recommendedAction: recommendAction(nrwPercent, nrwGal)
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function classifyPriority(score, nrwPercent) {
  if (nrwPercent >= 35 || score >= 70) return 'Critical';
  if (nrwPercent >= 25 || score >= 50) return 'High';
  if (nrwPercent >= 15 || score >= 30) return 'Moderate';
  return 'Monitor';
}

function recommendAction(nrwPercent, nrwGal) {
  if (nrwPercent >= 35) {
    return 'Immediate leak survey, meter validation, and pressure review.';
  }

  if (nrwPercent >= 25) {
    return 'Prioritize field investigation and billing/meter audit.';
  }

  if (nrwPercent >= 15) {
    return 'Monitor trend and verify master meter/customer reads.';
  }

  if (nrwGal > 0) {
    return 'Maintain baseline monitoring.';
  }

  return 'No action required until data improves.';
}

function normalizeCost(value) {
  if (value >= 1000000) return 100;
  return Math.min((value / 1000000) * 100, 100);
}

function normalizeVolume(value) {
  if (value >= 10000000) return 100;
  return Math.min((value / 10000000) * 100, 100);
}