import { getCustomersByUtility } from '../supabase/customers.js';
import { getDmasByUtility } from '../supabase/dmas.js';
import { getMeterReadsByMonth } from '../supabase/meterReads.js';
import { getReceiptsByUtility } from '../supabase/receipts.js';
import { getNrwReportsByUtility } from '../supabase/nrw.js';

export async function getDashboardKpis(utilityId) {
  const month = new Date().toISOString().slice(0, 7);

  const [customers, dmas, reads, receipts, nrwReports] = await Promise.all([
    getCustomersByUtility(utilityId),
    getDmasByUtility(utilityId),
    getMeterReadsByMonth(utilityId, month),
    getReceiptsByUtility(utilityId),
    getNrwReportsByUtility(utilityId)
  ]);

  const latestNrw = nrwReports[0];

  return {
    customerCount: customers.length,
    dmaCount: dmas.length,
    readCount: reads.length,
    receiptCount: receipts.length,
    latestNrwPercent: latestNrw ? Number(latestNrw.nrw_percent || 0) : 0
  };
}