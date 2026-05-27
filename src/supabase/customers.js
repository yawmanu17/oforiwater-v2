import { supabase } from './client.js';

export async function createCustomer(payload) {
  const { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function upsertCustomer(payload) {
  const { data, error } = await supabase
    .from('customers')
    .upsert(payload, {
      onConflict: 'utility_id,account_number'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCustomersByUtility(utilityId) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('utility_id', utilityId)
    .order('account_number');

  if (error) throw error;
  return data || [];
}

export async function updateCustomer(customerId, payload) {
  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', customerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}