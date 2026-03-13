/**
 * Raw Supabase client without strict type checking
 * This is needed because the auto-generated types don't include our custom tables
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://krkybhborwvcbjzjcghw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtya3liaGJvcnd2Y2JqempjZ2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTYwNDksImV4cCI6MjA4NzA3MjA0OX0.mwm0aTd9ZBltJD5VgOFN7vZ6jibpKsF8dGdcSwOg1cw";

// Create untyped client for flexibility with our custom schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any, "public", any> = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
