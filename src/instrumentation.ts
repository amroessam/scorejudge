import { initTracing } from './lib/tracing';

export async function register() {
    // Only initialize tracing on the server
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        initTracing();
    }
}
