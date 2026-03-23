export const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' && process.env.NODE_ENV !== 'production';
export const DECK_SIZE = DEBUG_MODE ? 6 : 52;
