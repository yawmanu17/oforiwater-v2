import { supabase } from './client.js';

export async function uploadUtilityLogo({ utilityId, file }) {
  if (!utilityId || !file) {
    throw new Error('Utility ID and logo file are required.');
  }

  const ext = file.name.split('.').pop() || 'png';
  const path = `${utilityId}/logo-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('utility-logos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('utility-logos')
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function uploadMeterReadPhoto({ utilityId, customerId, file }) {
  if (!utilityId || !customerId || !file) {
    throw new Error('Utility, customer, and file are required.');
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${utilityId}/${customerId}/meter-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('meter-read-photos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('meter-read-photos')
    .getPublicUrl(path);

  return data.publicUrl;
}