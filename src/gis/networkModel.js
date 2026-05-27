import {
  ccfToGallons,
  calculateNrw,
  getNrwStatus,
  getNrwStatusClass,
  formatGallons,
  formatPercent,
  numberOrZero
} from '../utils/calculations.js';

export function buildNetworkModel({
  customers = [],
  dmas = [],
  masterMeters = [],
  pipelines = [],
  meterReads = [],
  billingMonth = ''
}) {
  const readsByCustomer = new Map();

  meterReads.forEach((read) => {
    readsByCustomer.set(read.customer_id, read);
  });

  const dmaModels = dmas.map((dma) => {
    const dmaCustomers = customers.filter((customer) => customer.dma_id === dma.id);
    const dmaMasterMeters = masterMeters.filter((meter) => meter.dma_id === dma.id);
    const dmaPipelines = pipelines.filter((pipe) => pipe.dma_id === dma.id);

    const billedUsageGal = dmaCustomers.reduce((sum, customer) => {
      const read = readsByCustomer.get(customer.id);

      if (!read) return sum;

      if (numberOrZero(read.usage_gal) > 0) {
        return sum + numberOrZero(read.usage_gal);
      }

      return sum + ccfToGallons(read.usage_ccf);
    }, 0);

    const masterFlowGal = dmaMasterMeters.reduce((sum, meter) => {
      return sum + numberOrZero(meter.monthly_flow_gal);
    }, 0);

    const nrw = calculateNrw({
      masterFlowGal,
      billedUsageGal
    });

    return {
      dma,
      billingMonth,
      customers: dmaCustomers,
      masterMeters: dmaMasterMeters,
      pipelines: dmaPipelines,
      customerCount: dmaCustomers.length,
      masterMeterCount: dmaMasterMeters.length,
      pipelineCount: dmaPipelines.length,
      ...nrw,
      status: getNrwStatus(nrw.nrwPercent),
      statusClass: getNrwStatusClass(nrw.nrwPercent),
      health: getNrwHealth(nrw.nrwPercent)
    };
  });

  return {
    billingMonth,
    dmas: dmaModels,
    totals: summarizeNetwork(dmaModels)
  };
}

function summarizeNetwork(dmaModels) {
  const masterFlowGal = dmaModels.reduce((sum, item) => sum + item.masterFlowGal, 0);
  const billedUsageGal = dmaModels.reduce((sum, item) => sum + item.authorizedGal, 0);
  const nrwGal = Math.max(masterFlowGal - billedUsageGal, 0);
  const nrwPercent = masterFlowGal > 0 ? (nrwGal / masterFlowGal) * 100 : 0;

  return {
    masterFlowGal,
    billedUsageGal,
    nrwGal,
    nrwPercent
  };
}

export function getNrwHealth(nrwPercent) {
  if (nrwPercent >= 30) return 'bad';
  if (nrwPercent >= 15) return 'warn';
  return 'ok';
}

export function getNrwColor(healthOrPercent) {
  if (typeof healthOrPercent === 'number') {
    if (healthOrPercent >= 30) return '#ef4444';
    if (healthOrPercent >= 15) return '#f59e0b';
    return '#16a34a';
  }

  if (healthOrPercent === 'bad') return '#ef4444';
  if (healthOrPercent === 'warn') return '#f59e0b';

  return '#16a34a';
}

export {
  formatGallons,
  formatPercent
};