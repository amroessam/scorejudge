export const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
export const DECK_SIZE = DEBUG_MODE ? 6 : 52;
