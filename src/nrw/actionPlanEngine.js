export function buildWaterLossActionPlan({
  metrics = {},
  prioritizedDmas = [],
  readiness = null
} = {}) {
  const actions = [];

  const nrwPercent = Number(metrics.nrwPercent || 0);
  const realLosses = Number(metrics.realLosses || 0);
  const apparentLosses = Number(metrics.apparentLosses || 0);
  const ili = Number(metrics.ili || 0);
  const crli = Number(metrics.crli || 0);

  if (nrwPercent >= 30) {
    actions.push(action(
      'Immediate NRW Reduction Program',
      'Critical',
      'Launch a 30–90 day water loss reduction program focused on the highest-risk DMAs.',
      [
        'Validate production and master meter accuracy.',
        'Review billing/export data for missing or duplicate accounts.',
        'Prioritize leak detection in top-ranked DMAs.',
        'Assign responsible staff and weekly progress tracking.'
      ]
    ));
  }

  if (realLosses > apparentLosses) {
    actions.push(action(
      'Real Loss / Leakage Control',
      'High',
      'Physical leakage appears to be the dominant loss category.',
      [
        'Perform minimum night flow analysis.',
        'Conduct acoustic leak surveys.',
        'Review pressure zones and pressure-reducing valves.',
        'Prioritize main and service-line repairs.'
      ]
    ));
  }

  if (apparentLosses >= realLosses && apparentLosses > 0) {
    actions.push(action(
      'Apparent Loss / Revenue Recovery',
      'High',
      'Metering, billing, theft, or data handling issues may be driving losses.',
      [
        'Review zero-usage and low-usage accounts.',
        'Test large meters and older customer meters.',
        'Audit estimated reads and skipped reads.',
        'Investigate unauthorized connections.'
      ]
    ));
  }

  if (ili >= 8 || crli >= 8) {
    actions.push(action(
      'Advanced Leakage Benchmarking',
      'High',
      'ILI/CRLI indicate elevated leakage performance concern.',
      [
        'Improve asset data quality.',
        'Collect average pressure and service-line information.',
        'Compare real losses by DMA.',
        'Develop a funded leakage reduction capital plan.'
      ]
    ));
  }

  prioritizedDmas.slice(0, 3).forEach((dma, index) => {
    actions.push(action(
      `DMA Priority #${index + 1}: ${dma.dma?.name || 'Unnamed DMA'}`,
      dma.priorityLevel || 'Moderate',
      dma.recommendedAction || 'Investigate this DMA based on NRW performance.',
      [
        `NRW: ${formatPercent(dma.nrwPercent)}`,
        `NRW volume: ${formatNumber(dma.nrwGal)} gallons`,
        `Estimated annual loss: $${formatNumber(dma.annualLossCost)}`,
        'Verify master meter and customer read alignment.'
      ]
    ));
  });

  if (readiness?.missing?.length) {
    actions.push(action(
      'Data Quality Improvement',
      'Medium',
      'Some data needed for advanced NRW analysis is missing.',
      readiness.missing.map((item) => `Collect or improve: ${item}`)
    ));
  }

  if (!actions.length) {
    actions.push(action(
      'Maintain Monitoring',
      'Low',
      'Current indicators do not show major NRW concern based on available data.',
      [
        'Continue monthly NRW tracking.',
        'Maintain meter testing schedule.',
        'Review trends quarterly.',
        'Update DMA and asset records.'
      ]
    ));
  }

  return actions;
}

function action(title, priority, summary, steps) {
  return {
    title,
    priority,
    summary,
    steps
  };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}