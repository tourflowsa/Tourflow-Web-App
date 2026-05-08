import { createClient } from '@supabase/supabase-js';

/**
 * Safe Server-Side / Admin Client Module
 * 
 * WARNING: This module should ONLY be imported in secure server-side contexts 
 * (e.g., Supabase Edge Functions, Node.js API routes).
 * 
 * NEVER use the Service Role Key in the frontend client logic.
 */

const SUPABASE_URL = 'https://bztoyornjuyqgoqvmrqw.supabase.co';

export const createAdminClient = (serviceRoleKey: string) => {
  if (!serviceRoleKey) {
    throw new Error("Supabase Service Role Key is required for Admin Client.");
  }
  
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};
