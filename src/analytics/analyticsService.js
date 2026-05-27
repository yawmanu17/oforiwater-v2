import { getCustomersByUtility } from '../supabase/customers.js';
import { getMeterReadsByMonth } from '../supabase/meterReads.js';
import { getBillingReceiptsByMonth } from '../supabase/billingReports.js';
import { getNrwReportsByUtility } from '../supabase/nrw.js';

export async function getAnalyticsData(utilityId, billingMonth) {
  const [customers, reads, receipts, nrwReports] = await Promise.all([
    getCustomersByUtility(utilityId),
    getMeterReadsByMonth(utilityId, billingMonth),
    getBillingReceiptsByMonth(utilityId, billingMonth),
    getNrwReportsByUtility(utilityId)
  ]);

  return {
    customersByClass: summarizeCustomersByClass(customers),
    usageByClass: summarizeUsageByCustomerClass(reads),
    revenueSummary: summarizeRevenue(receipts),
    nrwTrend: summarizeNrwTrend(nrwReports)
  };
}

function summarizeCustomersByClass(customers) {
  const summary = {};

  customers.forEach((customer) => {
    const key = customer.customer_class || 'Unclassified';
    summary[key] = (summary[key] || 0) + 1;
  });

  return summary;
}

function summarizeUsageByCustomerClass(reads) {
  const summary = {};

  reads.forEach((read) => {
    const customerClass = read.customers?.customer_class || 'Unclassified';
    const usageGal = Number(read.usage_gal || read.usage_ccf * 748 || 0);

    summary[customerClass] = (summary[customerClass] || 0) + usageGal;
  });

  return summary;
}

function summarizeRevenue(receipts) {
  return {
    water: sum(receipts, 'water_charge'),
    sewer: sum(receipts, 'sewer_charge'),
    fees: sum(receipts, 'fees'),
    taxes: sum(receipts, 'taxes'),
    adjustments: sum(receipts, 'adjustments'),
    total: sum(receipts, 'total_due')
  };
}

function summarizeNrwTrend(reports) {
  return reports
    .slice()
    .reverse()
    .slice(-12)
    .map((report) => ({
      month: report.billing_month,
      nrwPercent: Number(report.nrw_percent || 0)
    }));
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}