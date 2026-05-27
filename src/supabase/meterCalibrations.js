import { supabase } from './client.js';

export async function createMeterCalibration(payload) {
  const { data, error } = await supabase
    .from('meter_calibrations')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getMeterCalibrationsByUtility(utilityId) {
  const { data, error } = await supabase
    .from('meter_calibrations')
    .select(`
      *,
      customers (
        account_number,
        customer_name,
        meter_number
      )
    `)
    .eq('utility_id', utilityId)
    .order('calibration_date', { ascending: false });

  if (error) throw error;
  return data || [];
}