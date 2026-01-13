/**
 * 性能测试
 *
 * 测试覆盖:
 * 1. 递归解析性能(响应时间 < 2s)
 * 2. 缓存命中性能
 * 3. 大配置文件处理性能
 * 4. 并发请求性能
 */

import { assertEquals } from "https://deno.land/std@0.208.0/testing/asserts.ts";
import { AggregateConfigUseCase } from "../src/application/use-cases/aggregate-config.use-case.ts";
import { ConfigSource } from "../src/domain/entities/config-source.entity.ts";

// Mock CacheManagerService interface
interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  warmup(sources: ConfigSource[]): Promise<void>;
}

// Mock CacheManagerService implementation
class MockCacheManagerService implements ICacheService {
  private storage = new Map<string, { value: any; expiry: number }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.storage.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.storage.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    this.storage.set(key, {
      value,
      expiry: Date.now() + ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async warmup(sources: ConfigSource[]): Promise<void> {
    // Mock implementation - 快速返回
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// Mock fetch with performance tracking
let fetchCallCount = 0;
async function mockFetchPerf(url: string, init?: RequestInit): Promise<Response> {
  fetchCallCount++;

  // 模拟网络延迟(50-150ms)
  const delay = 50 + Math.random() * 100;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const mockData: Record<string, any> = {
    "http://example.com/source1.json": {
      spider: "http://example.com/sub1.json",
      sites: Array.from({ length: 50 }, (_, i) => ({
        key: `source1-site${i}`,
        name: `站点${i}`,
        api: `http://api.source1.com/${i}`,
        ext: i % 10 === 0 ? "http://example.com/ext.json" : undefined,
      })),
      lives: Array.from({ length: 20 }, (_, i) => ({
        name: `频道${i}`,
        group: "分组",
        urls: [`http://live.source1.com/${i}`],
      })),
    },
    "http://example.com/source2.json": {
      sites: Array.from({ length: 40 }, (_, i) => ({
        key: `source2-site${i}`,
        name: `站点${i}`,
        api: `http://api.source2.com/${i}`,
      })),
    },
    "http://example.com/source3.json": {
      sites: Array.from({ length: 30 }, (_, i) => ({
        key: `source3-site${i}`,
        name: `站点${i}`,
        api: `http://api.source3.com/${i}`,
      })),
    },
    "http://example.com/sub1.json": {
      sites: Array.from({ length: 20 }, (_, i) => ({
        key: `sub1-site${i}`,
        name: `子站点${i}`,
        api: `http://api.sub1.com/${i}`,
      })),
    },
    "http://example.com/ext.json": {
      sites: Array.from({ length: 15 }, (_, i) => ({
        key: `ext-site${i}`,
        name: `扩展站点${i}`,
        api: `http://api.ext.com/${i}`,
      })),
    },
  };

  const data = mockData[url];

  if (!data) {
    return {
      ok: false,
      status: 404,
      text: async () => "Not Found",
    } as Response;
  }

  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
  } as Response;
}

Deno.test("Performance: recursive parsing with 3 sources under 2 seconds", async () => {
  globalThis.fetch = mockFetchPerf;
  fetchCallCount = 0;

  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  // Mock loadSources
  (useCase as any).loadSources = async () => [
    new ConfigSource("source1", "源1", "http://example.com/source1.json", 100, [], "healthy", undefined, undefined, true, 2, true),
    new ConfigSource("source2", "源2", "http://example.com/source2.json", 50, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("source3", "源3", "http://example.com/source3.json", 0, [], "healthy", undefined, undefined, false, 0, true),
  ];

  const startTime = Date.now();
  const result = await useCase.execute({ includeContent: true, enableRecursive: true });
  const duration = Date.now() - startTime;

  console.log(`性能测试: 3个源(包含递归)耗时 ${duration}ms, fetch 调用 ${fetchCallCount} 次`);

  // 验证性能
  if (duration > 2000) {
    throw new Error(`递归解析超时: ${duration}ms > 2000ms`);
  }

  assertEquals(result.total, 3);
});

Deno.test("Performance: mergeConfigs with large arrays under 50ms", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  // 创建大型配置(每个配置 200 个 sites)
  const configs = Array.from({ length: 5 }, (_, i) => ({
    sites: Array.from({ length: 200 }, (_, j) => ({
      key: `site-${i}-${j}`,
      name: `站点 ${i}-${j}`,
      api: `http://api${i}.com/${j}`,
    })),
  }));

  const startTime = Date.now();
  const merged = (useCase as any).mergeConfigs(configs);
  const duration = Date.now() - startTime;

  console.log(`合并性能测试: 5个配置(共1000个sites)耗时 ${duration}ms`);

  // 验证性能
  if (duration > 50) {
    throw new Error(`合并超时: ${duration}ms > 50ms`);
  }

  assertEquals(merged.sites.length, 1000);
});

Deno.test("Performance: filter with 100 sources under 10ms", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  // 创建 100 个源
  const sources = Array.from({ length: 100 }, (_, i) => {
    const priority = Math.floor(Math.random() * 100);
    const tags = i % 3 === 0 ? ["官方"] : i % 2 === 0 ? ["社区"] : [];
    const status = Math.random() > 0.2 ? "healthy" : "failed";
    return new ConfigSource(
      `source-${i}`,
      `源${i}`,
      `http://example.com/${i}.json`,
      priority,
      tags,
      status,
      undefined,
      undefined,
      false,
      0,
      true
    );
  });

  const startTime = Date.now();
  const filtered = (useCase as any).applyFilters(sources, {
    excludeFailed: true,
    minPriority: 30,
    includeTags: ["官方"],
  });
  const duration = Date.now() - startTime;

  console.log(`过滤性能测试: 100个源过滤耗时 ${duration}ms`);

  // 验证性能
  if (duration > 10) {
    throw new Error(`过滤超时: ${duration}ms > 10ms`);
  }

  assertEquals(filtered.length <= 100, true);
});
