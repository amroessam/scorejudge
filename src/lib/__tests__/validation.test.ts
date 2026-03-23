import { validateGameName } from '@/lib/validation';

describe('validateGameName', () => {
    it('accepts valid game names', () => {
        expect(validateGameName('Friday Night Game')).toEqual({ valid: true, sanitized: 'Friday Night Game' });
        expect(validateGameName('Game #1')).toEqual({ valid: true, sanitized: 'Game #1' });
    });

    it('trims whitespace', () => {
        expect(validateGameName('  My Game  ')).toEqual({ valid: true, sanitized: 'My Game' });
    });

    it('rejects empty names', () => {
        expect(validateGameName('')).toEqual({ valid: false, error: 'Game name is required' });
        expect(validateGameName('   ')).toEqual({ valid: false, error: 'Game name is required' });
    });

    it('rejects names longer than 50 characters', () => {
        const longName = 'A'.repeat(51);
        expect(validateGameName(longName)).toEqual({ valid: false, error: 'Game name must be 50 characters or less' });
    });

    it('accepts names exactly 50 characters', () => {
        const name = 'A'.repeat(50);
        expect(validateGameName(name)).toEqual({ valid: true, sanitized: name });
    });

    it('strips HTML tags', () => {
        expect(validateGameName('<script>alert("xss")</script>Game')).toEqual({ valid: true, sanitized: 'alert("xss")Game' });
    });
});
