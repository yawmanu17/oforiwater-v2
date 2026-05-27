import { supabase } from './client.js';

export async function createBillingProfile(payload) {
  const { data, error } = await supabase
    .from('billing_profiles')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getBillingProfilesByUtility(utilityId) {
  const { data, error } = await supabase
    .from('billing_profiles')
    .select('*')
    .eq('utility_id', utilityId)
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}