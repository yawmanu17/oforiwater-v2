import { supabase } from '../supabase/client.js';
import { authState } from '../auth/auth.js';

export async function logAuditEvent({
  action,
  entityType,
  entityId = '',
  details = {}
}) {
  try {
    if (!authState.utility || !authState.profile) return;

    await supabase
      .from('audit_logs')
      .insert({
        utility_id: authState.utility.id,

        actor_profile_id: authState.profile.id,

        actor_email: authState.profile.email,

        action,

        entity_type: entityType,

        entity_id: entityId,

        details
      });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}