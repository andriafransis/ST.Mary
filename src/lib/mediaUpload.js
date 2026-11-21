import { supabase } from './supabase';

export async function uploadChurchMedia(file, folder = 'public') {
  if (!file) return '';
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const safeName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('church-media')
    .upload(safeName, file, { upsert: true });

  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('church-media').getPublicUrl(safeName);
  return data?.publicUrl || '';
}