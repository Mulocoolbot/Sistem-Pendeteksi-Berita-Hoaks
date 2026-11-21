import crypto from 'crypto';
import type { InvestigationReport } from '@/lib/types';

export const CACHE_TTL_MS = 15 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 100;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const TRACKING_QUERY_PARAMS = new Set(['fbclid', 'gclid', 'ref']);

export class LruTtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(maxEntries: number = CACHE_MAX_ENTRIES, defaultTtlMs: number = CACHE_TTL_MS) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Refresh key position so recently accessed entries stay in the LRU cache.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export function buildUrlCacheKey(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port ? `:${parsed.port}` : '';

    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '';

    const cleanParams: Array<[string, string]> = [];
    parsed.searchParams.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith('utm_') || TRACKING_QUERY_PARAMS.has(lowerKey)) {
        return;
      }
      cleanParams.push([key, value]);
    });

    cleanParams.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const search =
      cleanParams.length > 0
        ? `?${new URLSearchParams(cleanParams).toString()}`
        : '';

    return `url:${protocol}//${hostname}${port}${pathname}${search}`;
  } catch {
    return `url:${rawUrl.trim().toLowerCase()}`;
  }
}

export function buildImageCacheKey(base64Data: string): string {
  const commaIndex = base64Data.indexOf(',');
  const rawBase64 = commaIndex >= 0 ? base64Data.slice(commaIndex + 1) : base64Data;
  const normalized = rawBase64.replace(/\s+/g, '');
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `image:${hash}`;
}

export const analysisCache = new LruTtlCache<InvestigationReport>(
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS
);
