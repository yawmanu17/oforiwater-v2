import { supabase } from './client.js';

export async function upsertNrwReport(payload) {
  const { data, error } = await supabase
    .from('nrw_reports')
    .upsert(payload, {
      onConflict: 'dma_id,billing_month'
    })
    .select('*')
    .single();

  if (error) throw error;

  return data;
}

export async function getNrwReportsByUtility(utilityId) {
  const { data, error } = await supabase
    .from('nrw_reports')
    .select(`
      *,
      dmas (
        name,
        code
      )
    `)
    .eq('utility_id', utilityId)
    .order('billing_month', { ascending: false });

  if (error) throw error;

  return data || [];
}