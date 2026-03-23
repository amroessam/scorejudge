const locks = new Map<string, Promise<void>>();

export async function withGameLock<T>(
    gameId: string,
    operation: () => Promise<T>,
): Promise<T> {
    const existing = locks.get(gameId) || Promise.resolve();
    let resolve: () => void;
    const next = new Promise<void>(r => { resolve = r; });
    locks.set(gameId, next);

    try {
        await existing;
        return await operation();
    } finally {
        resolve!();
        if (locks.get(gameId) === next) {
            locks.delete(gameId);
        }
    }
}
