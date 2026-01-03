import { createClient } from '@supabase/supabase-js';

const isTest = process.env.NODE_ENV === 'test';

const supabaseUrl = isTest
    ? process.env.TEST_SUPABASE_URL || 'http://localhost:54321'
    : process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAnonKey = isTest
    ? process.env.TEST_SUPABASE_ANON_KEY || 'test-key'
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseServiceKey = isTest
    ? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || 'test-service-key'
    : process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for use in the browser (Realtime support)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for use in API routes (Bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
