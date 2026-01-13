/**
 * Deno 运行时适配器
 */
import { ICacheAdapter } from "../interfaces/cache-adapter.interface.ts";
import { DenoKVAdapter } from "../storage/deno-kv.adapter.ts";

/**
 * 内存缓存适配器（作为 KV 的后备方案）
 */
class MemoryCacheAdapter implements ICacheAdapter {
  private cache = new Map<string, { value: any; expires: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  async setMany<T>(
    entries: Array<{ key: string; value: T; ttl: number }>
  ): Promise<void> {
    await Promise.all(
      entries.map((entry) => this.set(entry.key, entry.value, entry.ttl))
    );
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
    } else {
      for (const key of this.cache.keys()) {
        if (key.startsWith(pattern)) {
          this.cache.delete(key);
        }
      }
    }
  }
}

export class DenoRuntimeAdapter {
  name = "deno";
  private kvCache: ICacheAdapter | null = null;

  constructor(private env: Record<string, string> = {}) {}

  async getKV(): Promise<ICacheAdapter> {
    if (!this.kvCache) {
      try {
        // 尝试使用 Deno KV
        if (typeof Deno.openKv === "function") {
          const kv = await Deno.openKv();
          this.kvCache = new DenoKVAdapter(kv);
          console.log("[Cache] Using Deno KV");
        } else {
          throw new Error("Deno.openKv not available");
        }
      } catch (error) {
        // 后备到内存缓存
        console.warn("[Cache] Deno KV not available, using memory cache:", error.message);
        this.kvCache = new MemoryCacheAdapter();
      }
    }
    return this.kvCache;
  }

  getLogger(): typeof console {
    return console;
  }
}
