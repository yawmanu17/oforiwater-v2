import { supabase } from './client.js';

export async function createAuditLog(payload) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.warn('Audit log failed:', error.message);
    return null;
  }

  return data;
}

export async function getAuditLogsByUtility(utilityId) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      profiles (
        full_name,
        email,
        role
      )
    `)
    .eq('utility_id', utilityId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}