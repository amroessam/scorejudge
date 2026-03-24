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
 * Check if an IP is a private/internal address (not geolocatable).
 */
function isPrivateIp(ip: string): boolean {
    return ip === '127.0.0.1' || ip === '::1' ||
        ip.startsWith('10.') ||
        ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') ||
        ip.startsWith('172.19.') ||
        ip.startsWith('172.20.') || ip.startsWith('172.21.') || ip.startsWith('172.22.') ||
        ip.startsWith('172.23.') || ip.startsWith('172.24.') || ip.startsWith('172.25.') ||
        ip.startsWith('172.26.') || ip.startsWith('172.27.') || ip.startsWith('172.28.') ||
        ip.startsWith('172.29.') || ip.startsWith('172.30.') || ip.startsWith('172.31.') ||
        ip.startsWith('192.168.');
}

/**
 * Get client IP from request headers.
 * Checks Cloudflare, then common proxy headers in priority order.
 */
function getClientIp(headers: Headers): string | null {
    // Cloudflare sends the real client IP in CF-Connecting-IP
    const cfIp = headers.get('CF-Connecting-IP');
    if (cfIp && !isPrivateIp(cfIp)) return cfIp;

    // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
    const forwarded = headers.get('X-Forwarded-For');
    if (forwarded) {
        const firstIp = forwarded.split(',')[0].trim();
        if (firstIp && !isPrivateIp(firstIp)) return firstIp;
    }

    const realIp = headers.get('X-Real-IP');
    if (realIp && !isPrivateIp(realIp)) return realIp;

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
