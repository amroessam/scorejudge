import { createLogger } from './logger';

const log = createLogger({ module: 'geolocation' });

/**
 * Extract country code from CDN-provided request headers.
 * Checks Cloudflare, Vercel, and AWS CloudFront headers first.
 * Falls back to IP geolocation API if no CDN headers are present.
 */
export function getCountryFromHeaders(headers: Headers): string | null {
    const cfCountry = headers.get('CF-IPCountry');
    if (cfCountry && cfCountry !== 'XX') return cfCountry.toUpperCase();

    const vercelCountry = headers.get('X-Vercel-IP-Country');
    if (vercelCountry) return vercelCountry.toUpperCase();

    const awsCountry = headers.get('CloudFront-Viewer-Country');
    if (awsCountry) return awsCountry.toUpperCase();

    return null;
}

/**
 * Get client IP from request headers.
 * Checks common proxy headers in priority order.
 */
function getClientIp(headers: Headers): string | null {
    // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
    const forwarded = headers.get('X-Forwarded-For');
    if (forwarded) {
        const firstIp = forwarded.split(',')[0].trim();
        if (firstIp && firstIp !== '127.0.0.1' && firstIp !== '::1') return firstIp;
    }

    const realIp = headers.get('X-Real-IP');
    if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') return realIp;

    return null;
}

/**
 * Look up country code from IP address using free geolocation API.
 * Uses ip-api.com (free, no API key needed, 45 req/min limit).
 * Only called on game creation — not on every request.
 */
async function lookupCountryByIp(ip: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) return null;

        const data = await res.json();
        if (data.status === 'success' && data.countryCode) {
            log.info({ ip, country: data.countryCode }, 'IP geolocation resolved');
            return data.countryCode.toUpperCase();
        }
        return null;
    } catch (err) {
        log.warn({ ip, error: (err as Error).message }, 'IP geolocation lookup failed');
        return null;
    }
}

/**
 * Get country code from request — tries CDN headers first, falls back to IP lookup.
 * This is an async function because the IP lookup fallback is async.
 */
export async function getCountryFromRequest(headers: Headers): Promise<string | null> {
    // Fast path: CDN headers (synchronous)
    const fromHeaders = getCountryFromHeaders(headers);
    if (fromHeaders) return fromHeaders;

    // Slow path: IP geolocation API (~50ms, only on game creation)
    const clientIp = getClientIp(headers);
    if (clientIp) {
        return lookupCountryByIp(clientIp);
    }

    log.warn('No geo headers and no client IP found');
    return null;
}
