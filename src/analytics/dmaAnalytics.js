import { forecastUsage } from './forecastEngine.js';

export function analyzeDmaTrends(reads = [], customers = []) {
  const customerToDma = new Map(
    customers.map((customer) => [
      customer.id,
      {
        dma_id: customer.dma_id,
        dma_name: customer.dma_name || customer.dmas?.name || 'Unknown DMA'
      }
    ])
  );

  const dmaMonthlyUsage = {};

  reads.forEach((read) => {
    const customerInfo = customerToDma.get(read.customer_id);

    if (!customerInfo?.dma_id) return;

    const month =
      read.billing_month ||
      read.reading_date?.slice(0, 7);

    if (!month) return;

    const dmaId = customerInfo.dma_id;

    dmaMonthlyUsage[dmaId] ||= {
      dma_id: dmaId,
      dma_name: customerInfo.dma_name,
      monthly: {}
    };

    dmaMonthlyUsage[dmaId].monthly[month] =
      (dmaMonthlyUsage[dmaId].monthly[month] || 0) +
      Number(read.usage_gal || 0);
  });

  return Object.values(dmaMonthlyUsage).map((dma) => {
    const months = Object.keys(dma.monthly).sort();
    const usageHistory = months.map((month) => dma.monthly[month]);

    const forecast = forecastUsage(usageHistory);

    return {
      dma_id: dma.dma_id,
      dma_name: dma.dma_name,
      months,
      usageHistory,
      forecastUsage: forecast.forecast,
      trend: forecast.trend
    };
  });
}