import { supabase } from './client.js';

export async function createBillingAdjustment(payload) {
  const { data, error } = await supabase
    .from('billing_adjustments')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  return data;
}

export async function getAdjustmentsByUtility(utilityId) {
  const { data, error } = await supabase
    .from('billing_adjustments')
    .select(`
      *,
      customers (
        account_number,
        customer_name
      ),
      profiles (
        full_name,
        email
      )
    `)
    .eq('utility_id', utilityId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function getAdjustmentsByCustomer(customerId) {
  const { data, error } = await supabase
    .from('billing_adjustments')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}