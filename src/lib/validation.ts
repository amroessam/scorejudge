interface ValidationResult {
    valid: boolean;
    sanitized?: string;
    error?: string;
}

export function validateGameName(name: string): ValidationResult {
    const stripped = name.replace(/<[^>]*>/g, '');
    const trimmed = stripped.trim();

    if (!trimmed) {
        return { valid: false, error: 'Game name is required' };
    }

    if (trimmed.length > 50) {
        return { valid: false, error: 'Game name must be 50 characters or less' };
    }

    return { valid: true, sanitized: trimmed };
}
