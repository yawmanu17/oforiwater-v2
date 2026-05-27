import { supabase } from './client.js';

export async function createBillingReceipt(payload) {
  const { data, error } = await supabase
    .from('billing_receipts')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getReceiptsByUtility(utilityId) {
  const { data, error } = await supabase
    .from('billing_receipts')
    .select(`
      *,
      customers (
        account_number,
        customer_name,
        service_address,
        billing_email
      )
    `)
    .eq('utility_id', utilityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}