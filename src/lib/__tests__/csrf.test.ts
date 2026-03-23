/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const originalEnv = process.env.NODE_ENV;

function makeRequest(method: string, headers: Record<string, string> = {}): NextRequest {
    const url = 'https://scorejudge.com/api/test';
    const reqHeaders = new Headers(headers);
    if (!headers['host']) reqHeaders.set('host', 'scorejudge.com');
    return new NextRequest(url, { method, headers: reqHeaders });
}

describe('validateCSRF', () => {
    let validateCSRF: (req: NextRequest) => boolean;

    beforeAll(async () => {
        process.env.NODE_ENV = 'production';
        jest.resetModules();
        const csrf = await import('@/lib/csrf');
        validateCSRF = csrf.validateCSRF;
    });

    afterAll(() => {
        process.env.NODE_ENV = originalEnv;
    });

    it('allows GET requests regardless of headers', () => {
        const req = makeRequest('GET');
        expect(validateCSRF(req)).toBe(true);
    });

    it('allows POST with valid same-origin Origin header', () => {
        const req = makeRequest('POST', {
            origin: 'https://scorejudge.com',
            host: 'scorejudge.com',
        });
        expect(validateCSRF(req)).toBe(true);
    });

    it('rejects POST when both Origin and Referer are missing in production', () => {
        const req = makeRequest('POST', { host: 'scorejudge.com' });
        expect(validateCSRF(req)).toBe(false);
    });

    it('rejects POST with mismatched Origin header', () => {
        const req = makeRequest('POST', {
            origin: 'https://evil.com',
            host: 'scorejudge.com',
        });
        expect(validateCSRF(req)).toBe(false);
    });

    it('allows POST with valid Referer when Origin is missing', () => {
        const req = makeRequest('POST', {
            referer: 'https://scorejudge.com/dashboard',
            host: 'scorejudge.com',
        });
        expect(validateCSRF(req)).toBe(true);
    });
});
