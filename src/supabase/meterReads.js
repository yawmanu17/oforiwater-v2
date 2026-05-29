import { supabase } from './client.js';

export async function saveMeterRead(payload) {
  const { data, error } = await supabase
    .from('meter_reads')
    .upsert(payload, {
      onConflict: 'customer_id,billing_month'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMeterReadsByMonth(utilityId, billingMonth) {
  const { data, error } = await supabase
    .from('meter_reads')
    .select(`
      *,
      customers (
        account_number,
        customer_name,
        customer_class,
        service_address,
        meter_number
      )
    `)
    .eq('utility_id', utilityId)
    .eq('billing_month', billingMonth)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getRecentMeterReadsByUtility(utilityId, limit = 25) {
  const { data, error } = await supabase
    .from('meter_reads')
    .select(`
      *,
      customers (
        account_number,
        customer_name,
        meter_number,
        service_address
      )
    `)
    .eq('utility_id', utilityId)
    .order('reading_date', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data || [];
}