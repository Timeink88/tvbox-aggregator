/**
 * 边界条件测试
 *
 * 测试覆盖:
 * 1. 空配置源数组
 * 2. 单个源无递归
 * 3. 所有源获取失败
 * 4. 配置 JSON 格式错误
 * 5. 超时场景
 * 6. 空配置内容
 * 7. 极端参数值
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/testing/asserts.ts";
import { AggregateConfigUseCase } from "../src/application/use-cases/aggregate-config.use-case.ts";
import { SourceValidatorService } from "../src/domain/services/source-validator.service.ts";
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
    console.log(`[MockCache] Warming up ${sources.length} sources`);
  }
}

// Mock fetch for edge cases
async function mockFetchEdge(url: string, init?: RequestInit): Promise<Response> {
  await new Promise((resolve) => setTimeout(resolve, 10));

  const edgeCases: Record<string, any> = {
    "http://example.com/valid.json": {
      sites: [{ key: "site1", name: "站点1", api: "http://api.com" }],
    },
    "http://example.com/empty.json": {},
    "http://example.com/invalid-syntax.json": '{ "sites": [ }', // 无效 JSON
    "http://example.com/with-comments.json": `
      {
        "sites": [
          { "key": "site1", "name": "站点1" } // 注释
        ],
      }
    `,
    "http://example.com/with-trailing-comma.json": '{ "sites": [{ "key": "site1" },], }',
    "http://example.com/timeout.json": null, // 触发超时
    "http://example.com/not-tvbox.json": { random: "data" },
  };

  const data = edgeCases[url];

  if (data === null) {
    throw new Error("Network error");
  }

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
    text: async () => typeof data === "string" ? data : JSON.stringify(data),
  } as Response;
}

Deno.test("Edge Case: empty sources array", async () => {
  globalThis.fetch = mockFetchEdge;

  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache);

  (useCase as any).loadSources = async () => [];

  const result = await useCase.execute({ includeContent: false });

  assertEquals(result.total, 0);
  assertEquals(result.sources.length, 0);
  assertEquals(result.healthySources, 0);

  console.log("✓ 边界测试通过: 空源数组正确处理");
});

Deno.test("Edge Case: single source without recursion", async () => {
  globalThis.fetch = mockFetchEdge;

  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache);

  (useCase as any).loadSources = async () => [
    new ConfigSource("single", "单源", "http://example.com/valid.json", 50, [], undefined, undefined, undefined, false, 0, true),
  ];

  const result = await useCase.execute({ includeContent: true, enableRecursive: false });

  assertEquals(result.total, 1);
  assertExists(result.merged_config);
  assertEquals(result.merged_config.sites.length, 1);

  console.log("✓ 边界测试通过: 单个源无递归正确处理");
});

Deno.test("Edge Case: all sources failed", async () => {
  globalThis.fetch = async (url: string, init?: RequestInit) => {
    throw new Error("All sources failed");
  };

  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache);

  (useCase as any).loadSources = async () => [
    new ConfigSource("failed1", "失败源1", "http://example.com/failed1.json", 50, [], undefined, undefined, undefined, false, 0, true),
    new ConfigSource("failed2", "失败源2", "http://example.com/failed2.json", 50, [], undefined, undefined, undefined, false, 0, true),
  ];

  const result = await useCase.execute({ includeContent: false });

  assertEquals(result.total, 2);
  assertEquals(result.sources.length, 2);
  // 所有源状态应为 failed 或 timeout
  const allFailed = result.sources.every((s: any) => s.status === "failed" || s.status === "timeout");
  assertEquals(allFailed, true);

  console.log("✓ 边界测试通过: 所有源失败正确处理");
});

Deno.test("Edge Case: empty config content", async () => {
  globalThis.fetch = mockFetchEdge;

  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache);

  (useCase as any).loadSources = async () => [
    new ConfigSource("empty", "空配置", "http://example.com/empty.json", 50, [], undefined, undefined, undefined, false, 0, true),
  ];

  const result = await useCase.execute({ includeContent: true });

  assertEquals(result.total, 1);
  // 空配置应该被标记为 degraded
  assertEquals(result.sources[0].status, "degraded");

  console.log("✓ 边界测试通过: 空配置内容正确处理");
});

Deno.test("Edge Case: invalid JSON syntax", async () => {
  globalThis.fetch = mockFetchEdge;

  const validator = new SourceValidatorService();
  const source = new ConfigSource("invalid", "无效JSON", "http://example.com/invalid-syntax.json", 50, [], undefined, undefined, undefined, false, 0, true);

  try {
    await validator.fetchAndValidate(source, 0, new Set());
    // 如果没有抛出错误,测试失败
    assertEquals(true, false, "应该抛出 JSON 解析错误");
  } catch (error) {
    assertEquals(error.message.includes("Circular reference") || error.message.includes("JSON"), true);
  }

  console.log("✓ 边界测试通过: 无效 JSON 语法正确处理");
});

Deno.test("Edge Case: JSON with comments", async () => {
  globalThis.fetch = mockFetchEdge;

  const validator = new SourceValidatorService();
  const source = new ConfigSource("comments", "带注释", "http://example.com/with-comments.json", 50, [], undefined, undefined, undefined, false, 0, true);

  const config = await validator.fetchAndValidate(source, 0, new Set());

  assertExists(config.sites);
  assertEquals(config.sites.length, 1);

  console.log("✓ 边界测试通过: 带注释的 JSON 正确处理");
});

Deno.test("Edge Case: JSON with trailing commas", async () => {
  globalThis.fetch = mockFetchEdge;

  const validator = new SourceValidatorService();
  const source = new ConfigSource("trailing", "尾逗号", "http://example.com/with-trailing-comma.json", 50, [], undefined, undefined, undefined, false, 0, true);

  const config = await validator.fetchAndValidate(source, 0, new Set());

  assertExists(config.sites);
  assertEquals(config.sites.length, 1);

  console.log("✓ 边界测试通过: 带尾逗号的 JSON 正确处理");
});

Deno.test("Edge Case: not TVBox config format", async () => {
  globalThis.fetch = mockFetchEdge;

  const validator = new SourceValidatorService();
  const source = new ConfigSource("notvbox", "非TVBox", "http://example.com/not-tvbox.json", 50, [], undefined, undefined, undefined, false, 0, true);

  const config = await validator.fetchAndValidate(source, 0, new Set());

  // 非标准配置应被标记为 degraded
  assertEquals(source.status, "degraded");

  console.log("✓ 边界测试通过: 非 TVBox 配置格式正确处理");
});

Deno.test("Edge Case: extreme parameter values", async () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache);

  (useCase as any).loadSources = async () => [
    new ConfigSource("s1", "源1", "http://example.com/1.json", 0, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s2", "源2", "http://example.com/2.json", 100, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s3", "源3", "http://example.com/3.json", 50, [], "healthy", undefined, undefined, false, 0, true),
  ];

  // 测试极端参数值
  const extremeOptions = [
    { minPriority: 0 },
    { minPriority: 100 },
    { maxSources: 0 },
    { maxSources: 1000 },
    { maxDepthOverride: 0 },
    { maxDepthOverride: 100 },
  ];

  for (const options of extremeOptions) {
    const result = await useCase.execute({ ...options, includeContent: false });
    assertExists(result);
  }

  console.log("✓ 边界测试通过: 极端参数值正确处理");
});

Deno.test("Edge Case: maxSources larger than available", async () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache);

  (useCase as any).loadSources = async () => [
    new ConfigSource("s1", "源1", "http://example.com/1.json", 50, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s2", "源2", "http://example.com/2.json", 50, [], "healthy", undefined, undefined, false, 0, true),
  ];

  const result = await useCase.execute({ maxSources: 100, includeContent: false });

  assertEquals(result.total, 2); // 应该返回所有可用源

  console.log("✓ 边界测试通过: maxSources 大于可用源数量正确处理");
});

Deno.test("Edge Case: duplicate URLs with different priorities", async () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache);

  (useCase as any).loadSources = async () => [
    new ConfigSource("s1", "源1", "http://example.com/same.json", 30, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s2", "源2", "http://example.com/same.json", 70, [], "healthy", undefined, undefined, false, 0, true),
  ];

  const result = await useCase.execute({ includeContent: false });

  // 两个源应该都存在(即使 URL 相同)
  assertEquals(result.total, 2);

  console.log("✓ 边界测试通过: 相同 URL 不同优先级正确处理");
});

Deno.test("Edge Case: empty tags array", async () => {
  const mockCache = new MockCacheManagerService();
  const useCase = new AggregateConfigUseCase(mockCache);

  (useCase as any).loadSources = async () => [
    new ConfigSource("s1", "源1", "http://example.com/1.json", 50, [], "healthy", undefined, undefined, false, 0, true),
    new ConfigSource("s2", "源2", "http://example.com/2.json", 50, ["tag1"], "healthy", undefined, undefined, false, 0, true),
  ];

  // 过滤空标签
  const result1 = await useCase.execute({ includeTags: [], includeContent: false });
  assertEquals(result1.total, 2);

  // 过滤存在的标签
  const result2 = await useCase.execute({ includeTags: ["tag1"], includeContent: false });
  assertEquals(result2.total, 1);

  console.log("✓ 边界测试通过: 空标签数组正确处理");
});

Deno.test("Edge Case: circular reference at first level", async () => {
  const validator = new SourceValidatorService();

  // Mock fetch 返回循环引用
  globalThis.fetch = async (url: string, init?: RequestInit) => {
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (url === "http://example.com/a.json") {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          spider: "http://example.com/b.json",
          sites: [{ key: "site-a", name: "站点A", api: "http://api.a.com" }],
        }),
      } as Response;
    } else if (url === "http://example.com/b.json") {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          spider: "http://example.com/a.json", // 循环引用
          sites: [{ key: "site-b", name: "站点B", api: "http://api.b.com" }],
        }),
      } as Response;
    }
    throw new Error("Not found");
  };

  const sourceA = new ConfigSource("a", "源A", "http://example.com/a.json", 50, [], undefined, undefined, undefined, true, 5, true);

  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string, init?: RequestInit) => {
    callCount++;
    return originalFetch(url, init);
  };

  try {
    const config = await validator.fetchAndValidate(sourceA, 0, new Set());
    // 验证没有无限递归
    assertEquals(callCount <= 4, true, `循环引用未检测: 调用 ${callCount} 次`);
    console.log("✓ 边界测试通过: 首层循环引用正确检测");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Edge Case: depth limit at zero", async () => {
  const validator = new SourceValidatorService();

  globalThis.fetch = async (url: string, init?: RequestInit) => {
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        spider: "http://example.com/child.json",
        sites: [{ key: "site1", name: "站点1", api: "http://api.com" }],
      }),
    } as Response;
  };

  const source = new ConfigSource("test", "测试", "http://example.com/parent.json", 50, [], undefined, undefined, undefined, true, 0, true);

  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string, init?: RequestInit) => {
    callCount++;
    return originalFetch(url, init);
  };

  try {
    const config = await validator.fetchAndValidate(source, 0, new Set());
    // maxDepth=0 时应该只获取父级,不递归
    assertEquals(callCount, 1, `深度限制未生效: 调用 ${callCount} 次`);
    console.log("✓ 边界测试通过: maxDepth=0 禁用递归正确处理");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
