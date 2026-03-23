import { withGameLock } from '@/lib/game-lock';

describe('withGameLock', () => {
    it('executes the operation and returns its result', async () => {
        const result = await withGameLock('game-1', async () => 'done');
        expect(result).toBe('done');
    });

    it('serializes concurrent operations on the same game', async () => {
        const order: number[] = [];
        const op1 = withGameLock('game-1', async () => {
            order.push(1);
            await new Promise(r => setTimeout(r, 50));
            order.push(2);
        });
        const op2 = withGameLock('game-1', async () => {
            order.push(3);
            await new Promise(r => setTimeout(r, 10));
            order.push(4);
        });
        await Promise.all([op1, op2]);
        expect(order).toEqual([1, 2, 3, 4]);
    });

    it('allows concurrent operations on different games', async () => {
        const order: string[] = [];
        const op1 = withGameLock('game-A', async () => {
            order.push('A-start');
            await new Promise(r => setTimeout(r, 50));
            order.push('A-end');
        });
        const op2 = withGameLock('game-B', async () => {
            order.push('B-start');
            await new Promise(r => setTimeout(r, 10));
            order.push('B-end');
        });
        await Promise.all([op1, op2]);
        expect(order.indexOf('A-start')).toBeLessThan(order.indexOf('A-end'));
        expect(order.indexOf('B-start')).toBeLessThan(order.indexOf('B-end'));
        expect(order.indexOf('B-end')).toBeLessThan(order.indexOf('A-end'));
    });

    it('releases the lock even if the operation throws', async () => {
        await expect(
            withGameLock('game-1', async () => { throw new Error('fail'); })
        ).rejects.toThrow('fail');
        const result = await withGameLock('game-1', async () => 'recovered');
        expect(result).toBe('recovered');
    });
});
