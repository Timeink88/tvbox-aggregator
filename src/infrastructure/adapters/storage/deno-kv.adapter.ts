/**
 * Deno KV 存储适配器
 */
import { ICacheAdapter } from "./interfaces/cache-adapter.interface.ts";

export class DenoKVAdapter implements ICacheAdapter {
  constructor(private kv: Deno.Kv) {}

  async get<T>(key: string): Promise<T | null> {
    const result = await this.kv.get<T>([key]);
    return result.value ?? null;
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.kv.set([key], value, {
      expireIn: ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete([key]);
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    const results = await this.kv.getMany<T>(keys.map((key) => [key]));
    return results.map((r) => r.value ?? null);
  }

  async setMany<T>(
    entries: Array<{ key: string; value: T; ttl: number }>
  ): Promise<void> {
    const atomic = this.kv.atomic();
    for (const entry of entries) {
      atomic.set([entry.key], entry.value, {
        expireIn: entry.ttl * 1000,
      });
    }
    await atomic.commit();
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      // 清空所有（危险操作，生产环境需谨慎）
      const entries = this.kv.list({ prefix: [] });
      for await (const entry of entries) {
        await this.kv.delete(entry.key);
      }
    } else {
      const entries = this.kv.list({ prefix: [pattern] });
      for await (const entry of entries) {
        await this.kv.delete(entry.key);
      }
    }
  }
}
