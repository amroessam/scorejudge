import { createClient, SupabaseClient } from '@supabase/supabase-js';

const isTest = process.env.NODE_ENV === 'test';

// Lazy initialization to avoid build-time errors when env vars aren't available
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseUrl(): string {
    if (isTest) {
        return process.env.TEST_SUPABASE_URL || 'http://localhost:54321';
    }
    return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

function getSupabaseAnonKey(): string {
    if (isTest) {
        return process.env.TEST_SUPABASE_ANON_KEY || 'test-key';
    }
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

function getSupabaseServiceKey(): string {
    if (isTest) {
        return process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
    }
    return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

// Client for use in the browser (Realtime support)
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_supabase) {
            const url = getSupabaseUrl();
            const key = getSupabaseAnonKey();
            if (url && key) {
                _supabase = createClient(url, key);
            } else {
                throw new Error('Supabase URL and Anon Key must be configured');
            }
        }
        return _supabase[prop as keyof SupabaseClient];
    }
});

// Admin client for use in API routes (Bypasses RLS)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_supabaseAdmin) {
            const url = getSupabaseUrl();
            const key = getSupabaseServiceKey();
            if (url && key) {
                _supabaseAdmin = createClient(url, key, {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                });
            } else {
                throw new Error('Supabase URL and Service Role Key must be configured');
            }
        }
        return _supabaseAdmin[prop as keyof SupabaseClient];
    }
});
