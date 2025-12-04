/**
 * Simple in-memory cache with TTL for server-side caching
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 100; // Max cache entries

  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    // Clean up expired entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      const toRemove = entries.slice(0, Math.floor(this.maxSize / 2));
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  // Generate cache key for bounds
  static boundsKey(bounds: { north: number; south: number; east: number; west: number }, prefix: string = ''): string {
    // Round to 3 decimal places (~100m precision) for better cache hits
    const n = bounds.north.toFixed(3);
    const s = bounds.south.toFixed(3);
    const e = bounds.east.toFixed(3);
    const w = bounds.west.toFixed(3);
    return `${prefix}:${s},${w},${n},${e}`;
  }

  // Generate cache key for point
  static pointKey(lat: number, lng: number, precision: number = 4): string {
    return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
  }
}

// Singleton instances
export const osmCache = new MemoryCache();
export const elevationCache = new MemoryCache();
export const natureZonesCache = new MemoryCache();

export default MemoryCache;
