/**
 * Raw Supabase client without strict type checking
 * This is needed because the auto-generated types don't include our custom tables
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://pxyyncsnjpuwvnwyfdwx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4eXluY3NuanB1d3Zud3lmZHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDY5NDMsImV4cCI6MjA4MzU4Mjk0M30.n-tEs1U3qB7E_eov-zVL2g7crlhNOqJ5cF5TcUeV_dI";

// Create untyped client for flexibility with our custom schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any, "public", any> = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
