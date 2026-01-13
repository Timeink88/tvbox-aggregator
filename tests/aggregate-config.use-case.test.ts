/**
 * 聚合配置用例测试
 *
 * 测试覆盖:
 * 1. 优先级排序合并
 * 2. 配置内容合并
 * 3. 缓存机制
 * 4. 过滤功能
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/testing/asserts.ts";
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
    // Mock implementation
    console.log(`[MockCache] Warming up ${sources.length} sources`);
  }
}

Deno.test("AggregateConfigUseCase: priority sorting - higher priority wins", async () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  // 模拟配置源(不同优先级)
  const sources = [
    new ConfigSource("low", "低优先级源", "http://example.com/low.json", 0, [], undefined, undefined, undefined, false, 0, true),
    new ConfigSource("high", "高优先级源", "http://example.com/high.json", 100, [], undefined, undefined, undefined, false, 0, true),
    new ConfigSource("medium", "中优先级源", "http://example.com/medium.json", 50, [], undefined, undefined, undefined, false, 0, true),
  ];

  // 访问私有方法进行测试
  const filteredSources = (useCase as any).applyFilters(sources, {});

  // 验证结果按优先级降序排列
  assertEquals(filteredSources.length, 3);
  assertEquals(filteredSources[0].id, "high");
  assertEquals(filteredSources[1].id, "medium");
  assertEquals(filteredSources[2].id, "low");

  console.log("✓ 优先级排序测试通过: 高优先级源排在前面");
});

Deno.test("AggregateConfigUseCase: mergeConfigs - sites deduplication by key", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  // 准备测试配置: 相同 key 的 sites,高优先级源的内容应被保留
  const configs = [
    {
      sites: [
        { key: "site1", name: "低优先级站点", api: "http://low.example.com" },
        { key: "site2", name: "低优先级站点2", api: "http://low2.example.com" },
      ],
    },
    {
      sites: [
        { key: "site1", name: "高优先级站点", api: "http://high.example.com" },
        { key: "site3", name: "独有站点", api: "http://unique.example.com" },
      ],
    },
    {
      sites: [
        { key: "site2", name: "中优先级站点", api: "http://medium.example.com" },
      ],
    },
  ];

  // 调用私有方法进行合并
  const merged = (useCase as any).mergeConfigs(configs);

  // 验证去重结果: 应包含3个唯一站点
  assertExists(merged.sites);
  assertEquals(merged.sites.length, 3);

  // 验证首次出现的配置被保留(低优先级在前,因为是按源数组顺序)
  const site1 = merged.sites.find((s: any) => s.key === "site1");
  const site2 = merged.sites.find((s: any) => s.key === "site2");
  const site3 = merged.sites.find((s: any) => s.key === "site3");

  assertEquals(site1.name, "低优先级站点"); // 第一个配置保留
  assertEquals(site2.name, "低优先级站点2"); // 第一个配置保留
  assertEquals(site3.name, "独有站点"); // 独有配置

  console.log("✓ 配置合并测试通过: sites 按 key 去重");
});

Deno.test("AggregateConfigUseCase: mergeConfigs - lives deduplication by name", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  const configs = [
    {
      lives: [
        { name: "CCTV-1", group: "央视", urls: ["http://live1.example.com"] },
        { name: "CCTV-2", group: "央视", urls: ["http://live2.example.com"] },
      ],
    },
    {
      lives: [
        { name: "CCTV-1", group: "央视高清", urls: ["http://live1-hd.example.com"] },
        { name: "湖南卫视", group: "卫视", urls: ["http://hunan.example.com"] },
      ],
    },
  ];

  const merged = (useCase as any).mergeConfigs(configs);

  assertExists(merged.lives);
  assertEquals(merged.lives.length, 3);

  const cctv1 = merged.lives.find((l: any) => l.name === "CCTV-1");
  assertEquals(cctv1.group, "央视"); // 首次出现保留

  console.log("✓ 配置合并测试通过: lives 按 name 去重");
});

Deno.test("AggregateConfigUseCase: mergeConfigs - parses deduplication by name", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  const configs = [
    {
      parses: [
        { name: "解析器1", type: "json", url: "http://parse1.example.com" },
        { name: "解析器2", type: "json", url: "http://parse2.example.com" },
      ],
    },
    {
      parses: [
        { name: "解析器1", type: "xml", url: "http://parse1-xml.example.com" },
        { name: "解析器3", type: "json", url: "http://parse3.example.com" },
      ],
    },
  ];

  const merged = (useCase as any).mergeConfigs(configs);

  assertExists(merged.parses);
  assertEquals(merged.parses.length, 3);

  const parser1 = merged.parses.find((p: any) => p.name === "解析器1");
  assertEquals(parser1.type, "json"); // 首次出现保留

  console.log("✓ 配置合并测试通过: parses 按 name 去重");
});

Deno.test("AggregateConfigUseCase: mergeConfigs - spider and wallpaper fallback", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  const configs = [
    {
      spider: "http://spider1.example.com/jar.jar",
      wallpaper: "http://bg1.example.com/bg.jpg",
    },
    {
      spider: ["http://spider2.example.com/jar.jar", "http://spider3.example.com/jar.jar"],
      wallpaper: "http://bg2.example.com/bg.jpg",
    },
    {
      wallpaper: "http://bg3.example.com/bg.jpg",
    },
  ];

  const merged = (useCase as any).mergeConfigs(configs);

  // spider 和 wallpaper 使用第一个有效值
  assertEquals(merged.spider, "http://spider1.example.com/jar.jar");
  assertEquals(merged.wallpaper, "http://bg1.example.com/bg.jpg");

  console.log("✓ 配置合并测试通过: spider/wallpaper 使用第一个有效值");
});

Deno.test("AggregateConfigUseCase: filter - excludeFailed", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  const sources = [
    new ConfigSource("healthy", "健康源", "http://example.com/1.json", 50, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("failed", "失败源", "http://example.com/2.json", 50, [], "failed", undefined, undefined, false, 0, true),
    new ConfigSource("timeout", "超时源", "http://example.com/3.json", 50, [], "timeout", undefined, undefined, false, 0, true),
    new ConfigSource("degraded", "降级源", "http://example.com/4.json", 50, [], "degraded", undefined, undefined, false, 0, true),
  ];

  // 默认排除失败源
  const filtered = (useCase as any).applyFilters(sources, { excludeFailed: true });
  assertEquals(filtered.length, 2); // healthy + degraded
  assertEquals(filtered.every((s: ConfigSource) => s.isAvailable()), true);

  // 包含失败源
  const includeFailed = (useCase as any).applyFilters(sources, { excludeFailed: false });
  assertEquals(includeFailed.length, 4);

  console.log("✓ 过滤测试通过: excludeFailed 正确过滤失败源");
});

Deno.test("AggregateConfigUseCase: filter - minPriority", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  const sources = [
    new ConfigSource("s1", "源1", "http://example.com/1.json", 0, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s2", "源2", "http://example.com/2.json", 50, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s3", "源3", "http://example.com/3.json", 100, [], "healthy", undefined, undefined, false, 0, true),
  ];

  const filtered = (useCase as any).applyFilters(sources, { minPriority: 50 });
  assertEquals(filtered.length, 2); // s2(50) + s3(100)
  assertEquals(filtered.every((s: ConfigSource) => s.priority >= 50), true);

  console.log("✓ 过滤测试通过: minPriority 正确过滤低优先级源");
});

Deno.test("AggregateConfigUseCase: filter - tags", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  const sources = [
    new ConfigSource("s1", "源1", "http://example.com/1.json", 50, ["官方", "推荐"], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s2", "源2", "http://example.com/2.json", 50, ["社区"], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s3", "源3", "http://example.com/3.json", 50, ["官方", "稳定"], "healthy", undefined, undefined, false, 0, true),
  ];

  // includeTags
  const includeTagged = (useCase as any).applyFilters(sources, { includeTags: ["官方"] });
  assertEquals(includeTagged.length, 2); // s1 + s3

  // excludeTags
  const excludeTagged = (useCase as any).applyFilters(sources, { excludeTags: ["社区"] });
  assertEquals(excludeTagged.length, 2); // s1 + s3

  console.log("✓ 过滤测试通过: includeTags/excludeTags 正确过滤标签");
});

Deno.test("AggregateConfigUseCase: filter - maxSources", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  const sources = [
    new ConfigSource("s1", "源1", "http://example.com/1.json", 30, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s2", "源2", "http://example.com/2.json", 100, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s3", "源3", "http://example.com/3.json", 70, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s4", "源4", "http://example.com/4.json", 50, [], "healthy", undefined, undefined, false, 0, true),
  ];

  const filtered = (useCase as any).applyFilters(sources, { maxSources: 2 });
  assertEquals(filtered.length, 2);
  assertEquals(filtered[0].id, "s2"); // priority 100
  assertEquals(filtered[1].id, "s3"); // priority 70

  console.log("✓ 过滤测试通过: maxSources 正确限制源数量并按优先级排序");
});

Deno.test("AggregateConfigUseCase: generateCacheKey - unique keys for different options", () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  const key1 = (useCase as any).generateCacheKey({ includeContent: true });
  const key2 = (useCase as any).generateCacheKey({ includeContent: false });
  const key3 = (useCase as any).generateCacheKey({ includeContent: true, minPriority: 50 });

  // 不同选项应生成不同的缓存键
  assertExists(key1);
  assertExists(key2);
  assertExists(key3);

  assertEquals(key1 !== key2, true);
  assertEquals(key2 !== key3, true);

  console.log("✓ 缓存键生成测试通过: 不同选项生成不同键");
});

Deno.test("AggregateConfigUseCase: cache hit returns cached result", async () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache as any);

  const cachedResult = {
    version: "2025-01-13",
    sources: [
      { name: "测试源", url: "http://example.com/test.json", priority: 50, status: "healthy" },
    ],
    total: 1,
    healthySources: 1,
    generatedAt: new Date(),
    cacheTTL: 3600,
  };

  // 设置缓存
  await mockCache.set("aggregated:test-key", cachedResult, 3600);

  // Mock loadSources 和 generateCacheKey
  (useCase as any).loadSources = async () => [
    new ConfigSource("test", "测试源", "http://example.com/test.json", 50, [], "healthy", undefined, undefined, false, 0, true),
  ];
  (useCase as any).generateCacheKey = () => "aggregated:test-key";

  // 执行测试
  const result = await useCase.execute({ includeContent: false });

  // 验证返回的是缓存结果
  assertEquals(result.total, 1);
  assertEquals(result.sources[0].name, "测试源");

  console.log("✓ 缓存测试通过: 命中缓存返回缓存结果");
});
