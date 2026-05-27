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