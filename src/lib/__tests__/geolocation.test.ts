/**
 * @jest-environment node
 */
import { getCountryFromRequest } from '@/lib/geolocation';

// Mock logger
jest.mock('@/lib/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }),
}));

// Mock fetch for IP geolocation API
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('getCountryFromRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // CDN header tests (fast path — no API call)
    it('returns country from CF-IPCountry header', async () => {
        const headers = new Headers({ 'CF-IPCountry': 'AE' });
        expect(await getCountryFromRequest(headers)).toBe('AE');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns country from X-Vercel-IP-Country header', async () => {
        const headers = new Headers({ 'X-Vercel-IP-Country': 'PK' });
        expect(await getCountryFromRequest(headers)).toBe('PK');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('normalizes country code to uppercase', async () => {
        const headers = new Headers({ 'CF-IPCountry': 'ae' });
        expect(await getCountryFromRequest(headers)).toBe('AE');
    });

    it('ignores CF-IPCountry XX (unknown)', async () => {
        const headers = new Headers({ 'CF-IPCountry': 'XX' });
        // No other headers and no IP — returns null
        expect(await getCountryFromRequest(headers)).toBeNull();
    });

    // IP fallback tests (slow path — calls API)
    it('falls back to IP geolocation when no CDN headers', async () => {
        const headers = new Headers({ 'X-Forwarded-For': '203.0.113.50' });
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ status: 'success', countryCode: 'AE' }),
        });

        expect(await getCountryFromRequest(headers)).toBe('AE');
        expect(mockFetch).toHaveBeenCalledWith(
            'http://ip-api.com/json/203.0.113.50?fields=status,countryCode',
            expect.any(Object)
        );
    });

    it('uses first IP from X-Forwarded-For (multiple proxies)', async () => {
        const headers = new Headers({ 'X-Forwarded-For': '203.0.113.50, 10.0.0.1, 172.16.0.1' });
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ status: 'success', countryCode: 'PK' }),
        });

        expect(await getCountryFromRequest(headers)).toBe('PK');
        expect(mockFetch).toHaveBeenCalledWith(
            'http://ip-api.com/json/203.0.113.50?fields=status,countryCode',
            expect.any(Object)
        );
    });

    it('reads X-Real-IP when X-Forwarded-For is absent', async () => {
        const headers = new Headers({ 'X-Real-IP': '198.51.100.10' });
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ status: 'success', countryCode: 'GB' }),
        });

        expect(await getCountryFromRequest(headers)).toBe('GB');
    });

    it('returns null when IP API fails', async () => {
        const headers = new Headers({ 'X-Forwarded-For': '203.0.113.50' });
        mockFetch.mockRejectedValue(new Error('Network error'));

        expect(await getCountryFromRequest(headers)).toBeNull();
    });

    it('returns null when no headers and no IP', async () => {
        const headers = new Headers({});
        expect(await getCountryFromRequest(headers)).toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('ignores localhost IPs in X-Forwarded-For', async () => {
        const headers = new Headers({ 'X-Forwarded-For': '127.0.0.1' });
        expect(await getCountryFromRequest(headers)).toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
