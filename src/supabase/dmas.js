import { supabase } from './client.js';

export async function createDma(payload) {
  const { data, error } = await supabase
    .from('dmas')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateDma(dmaId, payload) {
  const { data, error } = await supabase
    .from('dmas')
    .update(payload)
    .eq('id', dmaId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getDmasByUtility(utilityId) {
  const { data, error } = await supabase
    .from('dmas')
    .select('*')
    .eq('utility_id', utilityId)
    .order('name');

  if (error) throw error;
  return data || [];
}