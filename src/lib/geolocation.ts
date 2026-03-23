/**
 * Extract country code from CDN-provided request headers.
 * Checks Cloudflare, Vercel, and AWS CloudFront headers.
 */
export function getCountryFromRequest(headers: Headers): string | null {
    const cfCountry = headers.get('CF-IPCountry');
    if (cfCountry && cfCountry !== 'XX') return cfCountry.toUpperCase();

    const vercelCountry = headers.get('X-Vercel-IP-Country');
    if (vercelCountry) return vercelCountry.toUpperCase();

    const awsCountry = headers.get('CloudFront-Viewer-Country');
    if (awsCountry) return awsCountry.toUpperCase();

    return null;
}
