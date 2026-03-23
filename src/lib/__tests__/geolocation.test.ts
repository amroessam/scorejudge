/**
 * @jest-environment node
 */
import { getCountryFromRequest } from '@/lib/geolocation';

describe('getCountryFromRequest', () => {
    it('returns country from CF-IPCountry header', () => {
        const headers = new Headers({ 'CF-IPCountry': 'AE' });
        expect(getCountryFromRequest(headers)).toBe('AE');
    });

    it('returns country from X-Vercel-IP-Country header', () => {
        const headers = new Headers({ 'X-Vercel-IP-Country': 'PK' });
        expect(getCountryFromRequest(headers)).toBe('PK');
    });

    it('returns null when no geo headers present', () => {
        const headers = new Headers({});
        expect(getCountryFromRequest(headers)).toBeNull();
    });

    it('normalizes country code to uppercase', () => {
        const headers = new Headers({ 'CF-IPCountry': 'ae' });
        expect(getCountryFromRequest(headers)).toBe('AE');
    });

    it('ignores CF-IPCountry XX (unknown)', () => {
        const headers = new Headers({ 'CF-IPCountry': 'XX' });
        expect(getCountryFromRequest(headers)).toBeNull();
    });
});
