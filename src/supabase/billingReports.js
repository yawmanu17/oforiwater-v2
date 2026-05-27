import { supabase } from './client.js';

export async function getBillingReceiptsByMonth(
  utilityId,
  billingMonth
) {
  const { data, error } = await supabase
    .from('billing_receipts')
    .select(`
      *,
      customers (
        account_number,
        customer_name,
        customer_class
      )
    `)
    .eq('utility_id', utilityId)
    .eq('billing_month', billingMonth)
    .order('receipt_number');

  if (error) throw error;

  return data || [];
}

export function summarizeBillingReceipts(receipts = []) {
  return receipts.reduce(
    (summary, receipt) => {
      summary.receiptCount += 1;

      summary.waterCharge += Number(
        receipt.water_charge || 0
      );

      summary.sewerCharge += Number(
        receipt.sewer_charge || 0
      );

      summary.fees += Number(
        receipt.fees || 0
      );

      summary.adjustments += Number(
        receipt.adjustments || 0
      );

      summary.taxes += Number(
        receipt.taxes || 0
      );

      summary.totalDue += Number(
        receipt.total_due || 0
      );

      summary.usageCcf += Number(
        receipt.usage_ccf || 0
      );

      summary.usageGal += Number(
        receipt.usage_gal || 0
      );

      return summary;
    },
    {
      receiptCount: 0,
      waterCharge: 0,
      sewerCharge: 0,
      fees: 0,
      adjustments: 0,
      taxes: 0,
      totalDue: 0,
      usageCcf: 0,
      usageGal: 0
    }
  );
}