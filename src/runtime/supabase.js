import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON are not set at build time');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,

    // The fix for the app's oldest silent failure. refresh_token was persisted
    // but never used, so an access token simply expired after an hour: calls
    // started failing with raw JWT errors and only a page reload signed the
    // user out. supabase-js refreshes on a background timer AND on
    // visibilitychange, which is what matters for a phone that has been in a
    // pocket between casts.
    autoRefreshToken: true,

    // Handles the ?code= OAuth callback inside createClient, before any legacy
    // script exists. That is why Google sign-in needs no router -- the app has
    // no hash routing and no History API use at all; showPage() only toggles
    // CSS classes.
    detectSessionInUrl: true,
    flowType: 'pkce',

    storage: window.localStorage,
    storageKey: 'fishwizz.auth',
  },
});
