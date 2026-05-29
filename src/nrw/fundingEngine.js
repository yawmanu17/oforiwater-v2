export function buildFundingJustification({
  metrics = {},
  businessCase = {},
  prioritizedDmas = [],
  actionPlan = []
} = {}) {
  const annualImpact = Number(
    businessCase.totalAnnualImpact ||
    metrics.totalLossCost ||
    0
  );

  const nrwPercent = Number(metrics.nrwPercent || 0);
  const apparentLosses = Number(metrics.apparentLosses || 0);
  const realLosses = Number(metrics.realLosses || 0);

  const projects = [];

  if (realLosses > apparentLosses || nrwPercent >= 20) {
    projects.push(project({
      type: 'DMA Leak Detection Program',
      priority: priorityFromNrw(nrwPercent),
      estimatedCostLow: 25000,
      estimatedCostHigh: 150000,
      recoverablePercent: 0.08,
      annualImpact,
      rationale: 'High real-loss exposure indicates value in leak surveys, minimum night flow analysis, and field investigation.',
      fundingFit: ['State Revolving Fund', 'Local Capital Improvement Plan', 'Water Loss Reduction Grant']
    }));

    projects.push(project({
      type: 'Pressure Management Improvements',
      priority: nrwPercent >= 30 ? 'High' : 'Moderate',
      estimatedCostLow: 50000,
      estimatedCostHigh: 300000,
      recoverablePercent: 0.06,
      annualImpact,
      rationale: 'Pressure management can reduce background leakage, burst frequency, and long-term asset stress.',
      fundingFit: ['SRF', 'Asset Management Program', 'Capital Improvement Program']
    }));
  }

  if (apparentLosses >= realLosses || apparentLosses > 0) {
    projects.push(project({
      type: 'Meter Testing / Meter Replacement Program',
      priority: apparentLosses > realLosses ? 'High' : 'Moderate',
      estimatedCostLow: 30000,
      estimatedCostHigh: 250000,
      recoverablePercent: 0.1,
      annualImpact,
      rationale: 'Apparent losses suggest under-registration, meter age issues, unauthorized use, or billing data errors.',
      fundingFit: ['Revenue Recovery Program', 'AMI/AMR Modernization', 'Utility Operating Budget']
    }));

    projects.push(project({
      type: 'Billing Data Quality Cleanup',
      priority: 'High',
      estimatedCostLow: 10000,
      estimatedCostHigh: 75000,
      recoverablePercent: 0.05,
      annualImpact,
      rationale: 'Billing/data cleanup can recover lost revenue quickly by correcting skipped accounts, bad multipliers, estimated reads, or duplicate/missing records.',
      fundingFit: ['Operating Budget', 'Revenue Recovery Initiative']
    }));
  }

  if (prioritizedDmas.length) {
    const topDma = prioritizedDmas[0];

    projects.push(project({
      type: `Priority DMA Intervention: ${topDma.dma?.name || 'Top DMA'}`,
      priority: topDma.priorityLevel || 'High',
      estimatedCostLow: 20000,
      estimatedCostHigh: 200000,
      recoverablePercent: 0.12,
      annualImpact: Number(topDma.annualLossCost || annualImpact),
      rationale: 'Top-ranked DMA has the strongest combination of NRW percentage, NRW volume, and estimated loss exposure.',
      fundingFit: ['DMA Program', 'SRF', 'Capital Improvement Plan']
    }));
  }

  if (!projects.length) {
    projects.push(project({
      type: 'NRW Data Quality and Audit Improvement',
      priority: 'Moderate',
      estimatedCostLow: 5000,
      estimatedCostHigh: 25000,
      recoverablePercent: 0.02,
      annualImpact,
      rationale: 'Current data is insufficient for advanced funding justification. Improve audit inputs, meter records, pressure data, and billing exports.',
      fundingFit: ['Operating Budget', 'Technical Assistance']
    }));
  }

  return {
    annualImpact,
    fundingReadiness: classifyFundingReadiness({
      metrics,
      businessCase,
      prioritizedDmas,
      actionPlan
    }),
    projects
  };
}

function project({
  type,
  priority,
  estimatedCostLow,
  estimatedCostHigh,
  recoverablePercent,
  annualImpact,
  rationale,
  fundingFit
}) {
  const estimatedAnnualRecovery =
    Number(annualImpact || 0) * Number(recoverablePercent || 0);

  const paybackLow =
    estimatedAnnualRecovery > 0
      ? estimatedCostLow / estimatedAnnualRecovery
      : null;

  const paybackHigh =
    estimatedAnnualRecovery > 0
      ? estimatedCostHigh / estimatedAnnualRecovery
      : null;

  return {
    type,
    priority,
    estimatedCostLow,
    estimatedCostHigh,
    estimatedAnnualRecovery,
    paybackLowYears: paybackLow,
    paybackHighYears: paybackHigh,
    rationale,
    fundingFit
  };
}

function classifyFundingReadiness({
  metrics,
  businessCase,
  prioritizedDmas,
  actionPlan
}) {
  let score = 0;

  if (Number(metrics.nrwPercent || 0) > 0) score += 20;
  if (Number(metrics.realLosses || 0) > 0) score += 20;
  if (Number(metrics.apparentLosses || 0) > 0) score += 15;
  if (Number(businessCase.totalAnnualImpact || 0) > 0) score += 20;
  if (prioritizedDmas.length) score += 15;
  if (actionPlan.length) score += 10;

  if (score >= 80) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

function priorityFromNrw(nrwPercent) {
  if (nrwPercent >= 30) return 'Critical';
  if (nrwPercent >= 20) return 'High';
  if (nrwPercent >= 10) return 'Moderate';
  return 'Monitor';
}