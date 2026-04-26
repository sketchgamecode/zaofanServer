const playerLocks = new Map<string, Promise<void>>();

/**
 * Single-instance in-memory mutex.
 * This only serializes actions inside one Node process.
 * Multi-instance deployment must replace this with stateRevision CAS or a DB lock.
 */
export async function withPlayerLock<T>(playerId: string, fn: () => Promise<T>): Promise<T> {
  const previous = playerLocks.get(playerId) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  playerLocks.set(playerId, previous.then(() => current));
  await previous;

  try {
    return await fn();
  } finally {
    release();
    if (playerLocks.get(playerId) === current) {
      playerLocks.delete(playerId);
    }
  }
}
