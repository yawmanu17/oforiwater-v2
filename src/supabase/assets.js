import { supabase } from './client.js';

export async function getMasterMetersByUtility(utilityId) {
  const { data, error } = await supabase
    .from('master_meters')
    .select('*')
    .eq('utility_id', utilityId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getPipelinesByUtility(utilityId) {
  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('utility_id', utilityId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createMasterMeter(payload) {
  const { data, error } = await supabase
    .from('master_meters')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function createPipeline(payload) {
  const { data, error } = await supabase
    .from('pipelines')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updatePipeline(pipelineId, payload) {
  const { data, error } = await supabase
    .from('pipelines')
    .update(payload)
    .eq('id', pipelineId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateMasterMeter(masterMeterId, payload) {
  const { data, error } = await supabase
    .from('master_meters')
    .update(payload)
    .eq('id', masterMeterId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMasterMeter(masterMeterId) {
  const { error } = await supabase
    .from('master_meters')
    .delete()
    .eq('id', masterMeterId);

  if (error) throw error;
  return true;
}

export async function deletePipeline(pipelineId) {
  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', pipelineId);

  if (error) throw error;
  return true;
}