export interface SeededRandom {
  next(): number;
  int(min: number, max: number): number;
  chanceBp(bp: number): boolean;
  pick<T>(items: readonly T[]): T;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeed(seed) || 0x6d2b79f5;

  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  return {
    next,
    int(min: number, max: number): number {
      if (max < min) {
        throw new Error(`Invalid int range: min=${min}, max=${max}`);
      }
      return Math.floor(next() * (max - min + 1)) + min;
    },
    chanceBp(bp: number): boolean {
      if (bp <= 0) return false;
      if (bp >= 10000) return true;
      return this.int(1, 10000) <= bp;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('Cannot pick from empty items');
      }
      return items[this.int(0, items.length - 1)];
    },
  };
}
