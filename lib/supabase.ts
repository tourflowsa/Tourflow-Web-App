import { createClient } from '@supabase/supabase-js';

// Configuration
// In a real production build, these would be loaded via import.meta.env.VITE_SUPABASE_URL
const SUPABASE_URL = 'https://bztoyornjuyqgoqvmrqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6dG95b3JuanV5cWdvcXZtcnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTMyMTYsImV4cCI6MjA4MDY2OTIxNn0.YvT9mpLXseD6R6cIQ3AyKZs7rjwO-fd0TpuohWJyAAE';

/**
 * Safe Frontend Client
 * Uses the Anon key. Restricted by Row Level Security (RLS) on the database.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
