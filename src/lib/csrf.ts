import { NextRequest } from 'next/server';

/**
 * Validates CSRF protection by checking Origin header
 * Next.js App Router automatically validates CSRF for POST/PUT/PATCH/DELETE,
 * but this provides additional explicit validation
 */
export function validateCSRF(req: NextRequest): boolean {
    // Skip CSRF check for GET/HEAD/OPTIONS requests
    const method = req.method;
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return true;
    }

    // Get Origin and Referer headers
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const host = req.headers.get('host');

    // In production, validate Origin header matches host
    if (process.env.NODE_ENV === 'production') {
        if (!origin && !referer) {
            // Allow if no origin/referer (e.g., Postman, curl) but log warning
            console.warn('CSRF: Missing Origin and Referer headers');
            return true; // Allow for API clients, but could be stricter
        }

        // Validate origin matches host
        if (origin) {
            try {
                const originUrl = new URL(origin);
                const hostUrl = new URL(`https://${host}`);
                
                // Allow if origin matches host (same origin)
                if (originUrl.hostname === hostUrl.hostname) {
                    return true;
                }
                
                // Allow if origin is in allowed list (for CORS scenarios)
                // This should be configured via environment variable
                const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
                if (allowedOrigins.includes(origin)) {
                    return true;
                }
            } catch (e) {
                console.warn('CSRF: Invalid Origin header format');
            }
        }

        // Check referer as fallback
        if (referer) {
            try {
                const refererUrl = new URL(referer);
                const hostUrl = new URL(`https://${host}`);
                
                if (refererUrl.hostname === hostUrl.hostname) {
                    return true;
                }
            } catch (e) {
                // Invalid referer format
            }
        }

        // In development, be more lenient
        return false;
    }

    // In development, allow localhost and ngrok
    if (origin) {
        try {
            const originUrl = new URL(origin);
            if (originUrl.hostname === 'localhost' || 
                originUrl.hostname.includes('ngrok') ||
                originUrl.hostname.includes('127.0.0.1')) {
                return true;
            }
        } catch (e) {
            // Invalid origin
        }
    }

    // Default: allow in development, deny in production
    const nodeEnv = process.env.NODE_ENV as string | undefined;
    return nodeEnv !== 'production';
}

