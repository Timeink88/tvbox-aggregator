/**
 * 缓存管理服务
 * 实现三级缓存策略
 */
import { ICacheAdapter } from "../../infrastructure/adapters/interfaces/cache-adapter.interface.ts";

export class CacheManagerService {
  private l1Cache: Map<string, CacheEntry> = new Map();
  private readonly L1_TTL = 300; // 5分钟
  private readonly L2_TTL = 3600; // 1小时

  constructor(private l2Cache: ICacheAdapter) {}

  /**
   * 获取缓存（三级缓存查找）
   */
  async get<T>(key: string): Promise<T | null> {
    // L1: 内存缓存
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      l1Entry.hitCount++;
      console.log(`[L1 Cache Hit] ${key}`);
      return l1Entry.value as T;
    }

    // L2: KV缓存
    const l2Value = await this.l2Cache.get<T>(key);
    if (l2Value) {
      console.log(`[L2 Cache Hit] ${key}`);
      // 回写L1
      this.setL1(key, l2Value, this.L1_TTL);
      return l2Value;
    }

    console.log(`[Cache Miss] ${key}`);
    return null;
  }

  /**
   * 设置缓存（同时写入L1和L2）
   */
  async set<T>(key: string, value: T, ttl: number = this.L2_TTL): Promise<void> {
    // 写入L1
    this.setL1(key, value, Math.min(ttl, this.L1_TTL));

    // 写入L2
    await this.l2Cache.set(key, value, ttl);

    console.log(`[Cache Set] ${key} (TTL: ${ttl}s)`);
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    await this.l2Cache.delete(key);
    console.log(`[Cache Delete] ${key}`);
  }

  /**
   * 清空缓存
   */
  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      // 清空匹配模式的缓存
      for (const key of this.l1Cache.keys()) {
        if (key.includes(pattern)) {
          this.l1Cache.delete(key);
        }
      }
      await this.l2Cache.clear(pattern);
    } else {
      // 清空所有缓存
      this.l1Cache.clear();
      await this.l2Cache.clear();
    }
    console.log(`[Cache Clear] pattern: ${pattern || "*"}`);
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const entries = Array.from(this.l1Cache.values());
    const totalHits = entries.reduce((sum, e) => sum + e.hitCount, 0);
    const size = new TextEncoder().encode(
      JSON.stringify(Array.from(this.l1Cache.entries()))
    ).length;

    return {
      l1Size: this.l1Cache.size,
      l1HitRate: entries.length > 0 ? totalHits / entries.length : 0,
      memoryUsage: `${(size / 1024).toFixed(2)} KB`,
    };
  }

  /**
   * 预热缓存
   */
  async warmup(keys: string[]): Promise<void> {
    console.log(`[Cache Warmup] Warming up ${keys.length} keys...`);

    const batchSize = 10;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (key) => {
          const value = await this.l2Cache.get(key);
          if (value) {
            this.setL1(key, value, this.L1_TTL);
          }
        })
      );
    }

    console.log(`[Cache Warmup] Complete`);
  }

  /**
   * 设置L1缓存
   */
  private setL1<T>(key: string, value: T, ttl: number): void {
    this.l1Cache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
      hitCount: 0,
    });
  }

  /**
   * 检查缓存是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  hitCount: number;
}

export interface CacheStats {
  l1Size: number;
  l1HitRate: number;
  memoryUsage: string;
}
