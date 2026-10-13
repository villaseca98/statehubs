import { describe, expect, it } from 'vitest';
import { recordWriteQueue } from './recordWrites';

describe('record write serialization', () => {
  it('waits for an earlier edit while other records remain writable', async () => {
    const enqueue = recordWriteQueue();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const events: string[] = [];
    const first = enqueue('a', async () => { await gate; events.push('first'); });
    const second = enqueue('a', async () => { events.push('second'); });
    await enqueue('b', async () => { events.push('other'); });
    expect(events).toEqual(['other']);
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(['other', 'first', 'second']);
  });
  it('reports a failed write and lets a subsequent attempt succeed', async () => {
    const enqueue = recordWriteQueue();
    const failure = enqueue('a', async () => { throw new Error('conflict'); });
    const next = enqueue('a', async () => 'saved');
    await expect(failure).rejects.toThrow('conflict');
    await expect(next).resolves.toBe('saved');
  });
});
