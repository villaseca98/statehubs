// Serialize edits to one record while unrelated records remain independent.
// A rejected save does not poison later attempts; callers retain each failure.
export function recordWriteQueue() {
  const pending = new Map<string, Promise<unknown>>();
  return function enqueue<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const previous = pending.get(id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    pending.set(id, next);
    const cleanup = () => { if (pending.get(id) === next) pending.delete(id); };
    void next.then(cleanup, cleanup);
    return next;
  };
}
