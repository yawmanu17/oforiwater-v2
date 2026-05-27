import { supabase } from './client.js';

export async function updateUtility(utilityId, payload) {
  const { data, error } = await supabase
    .from('utilities')
    .update(payload)
    .eq('id', utilityId)
    .select()
    .single();

  if (error) throw error;
  return data;
}