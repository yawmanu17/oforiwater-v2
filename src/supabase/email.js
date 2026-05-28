import { supabase } from './client.js';

export async function sendStaffInviteEmail({
  email,
 fullName,
  role,
  utilityName
}) {
  const { data, error } = await supabase.functions.invoke(
    'send-staff-invite',
    {
      body: {
        email,
        fullName,
        role,
        utilityName
      }
    }
  );

  if (error) throw error;

  if (data?.error) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : JSON.stringify(data.error)
    );
  }

  return data;
}