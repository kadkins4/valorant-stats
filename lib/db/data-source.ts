// Generic DB-primary / snapshot-fallback helper. The concrete loaders
// (getMatches, getRankHistory, …) live in queries.ts and call this.
interface Loaders<T> {
  fromDb: () => Promise<T>;
  fromSnapshot: () => T;
}

export async function withFallback<T>(loaders: Loaders<T>): Promise<T> {
  try {
    return await loaders.fromDb();
  } catch (e) {
    console.warn("DB unavailable, using snapshot:", (e as Error).message);
    return loaders.fromSnapshot();
  }
}
