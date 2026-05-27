import { authState } from '../auth/auth.js';
import { createAuditLog } from '../supabase/auditLogs.js';

export async function logActivity({
  action,
  entityType,
  entityId = null,
  description = '',
  metadata = {}
}) {
  const utility = authState.utility;
  const profile = authState.profile;

  if (!utility?.id || !profile?.id || !action || !entityType) {
    return null;
  }

  return createAuditLog({
    utility_id: utility.id,
    actor_id: profile.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
    metadata
  });
}