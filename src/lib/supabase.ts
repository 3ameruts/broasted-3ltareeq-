import { createClient } from '@supabase/supabase-js';

// The publishable key is meant to ship in the browser; row-level security in
// supabase/setup.sql decides who may write. Env vars override for other projects.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://xiforwroabkgcjcfkltr.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gT4u_I9M8_Fa25PJv00Ddg_TTXYAvre';

export const supabase = createClient(url, key);
export const IMAGE_BUCKET = 'site-images';
