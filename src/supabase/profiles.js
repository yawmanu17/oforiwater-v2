import { supabase } from './client.js';

export async function getProfilesByUtility(utilityId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('utility_id', utilityId)
    .order('full_name');

  if (error) throw error;
  return data || [];
}

export async function updateProfile(profileId, payload) {
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getPendingInviteByEmail(email) {
  const { data, error } = await supabase
    .from('staff_invites')
    .select('*')
    .eq('status', 'pending')
    .ilike('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createStaffInvite(payload) {
  const { data, error } = await supabase
    .from('staff_invites')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getStaffInvitesByUtility(utilityId) {
  const { data, error } = await supabase
    .from('staff_invites')
    .select('*')
    .eq('utility_id', utilityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function markInviteAccepted(inviteId) {
  const { data, error } = await supabase
    .from('staff_invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString()
    })
    .eq('id', inviteId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}