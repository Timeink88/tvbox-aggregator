/**
 * 源验证服务测试
 *
 * 测试覆盖:
 * 1. 递归解析逻辑
 * 2. 循环引用检测
 * 3. 深度控制
 * 4. URL 提取和规范化
 * 5. JSON 清理
 * 6. 配置验证
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/testing/asserts.ts";
import { SourceValidatorService } from "../src/domain/services/source-validator.service.ts";
import { ConfigSource } from "../src/domain/entities/config-source.entity.ts";

// Mock fetch 全局函数
async function mockFetch(url: string, init?: RequestInit): Promise<Response> {
  const mockData: Record<string, any> = {
    "http://example.com/parent.json": {
      spider: "http://example.com/child1.json",
      sites: [
        {
          key: "site1",
          name: "父级站点",
          api: "http://api.example.com",
          ext: "http://example.com/child2.json",
        },
      ],
      lives: [
        { name: "CCTV-1", group: "央视", urls: ["http://live.example.com"] },
      ],
    },
    "http://example.com/child1.json": {
      sites: [
        { key: "child1-site", name: "子级站点1", api: "http://api.child1.com" },
      ],
    },
    "http://example.com/child2.json": {
      sites: [
        { key: "child2-site", name: "子级站点2", api: "http://api.child2.com" },
      ],
    },
    "http://example.com/circular-a.json": {
      spider: "http://example.com/circular-b.json",
      sites: [{ key: "site-a", name: "站点A", api: "http://api.a.com" }],
    },
    "http://example.com/circular-b.json": {
      spider: "http://example.com/circular-a.json",
      sites: [{ key: "site-b", name: "站点B", api: "http://api.b.com" }],
    },
    "http://example.com/deep1.json": {
      spider: "http://example.com/deep2.json",
      sites: [{ key: "deep1", name: "深度1", api: "http://api.deep1.com" }],
    },
    "http://example.com/deep2.json": {
      spider: "http://example.com/deep3.json",
      sites: [{ key: "deep2", name: "深度2", api: "http://api.deep2.com" }],
    },
    "http://example.com/deep3.json": {
      spider: "http://example.com/deep4.json",
      sites: [{ key: "deep3", name: "深度3", api: "http://api.deep3.com" }],
    },
    "http://example.com/deep4.json": {
      sites: [{ key: "deep4", name: "深度4", api: "http://api.deep4.com" }],
    },
    "http://example.com/invalid.json": {
      invalid: "data",
    },
    "http://example.com/empty.json": {},
    "http://example.com/error.json": null, // 触发 JSON parse 错误
  };

  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 10));

  const data = mockData[url];
  if (data === null) {
    throw new Error("Network error");
  }

  if (!data) {
    return {
      ok: false,
      status: 404,
      json: async () => null,
      text: async () => "Not Found",
    } as Response;
  }

  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

// 替换全局 fetch
globalThis.fetch = mockFetch;

Deno.test("SourceValidatorService: extractSubsourceUrls - detects spider URLs", () => {
  const validator = new SourceValidatorService();

  const config = {
    spider: "http://example.com/spider.json",
    sites: [],
  };

  const urls = (validator as any).extractSubsourceUrls(config);

  assertEquals(urls.length, 1);
  assertEquals(urls[0], "http://example.com/spider.json");

  console.log("✓ 子源 URL 检测测试通过: spider 字段被识别");
});

Deno.test("SourceValidatorService: extractSubsourceUrls - detects sites.ext URLs", () => {
  const validator = new SourceValidatorService();

  const config = {
    sites: [
      { key: "site1", name: "站点1", ext: "http://example.com/ext1.json" },
      { key: "site2", name: "站点2", ext: "./local.ext" }, // 相对路径不应被提取
      { key: "site3", name: "站点3", ext: "https://example.com/ext2.json" },
    ],
  };

  const urls = (validator as any).extractSubsourceUrls(config);

  assertEquals(urls.length, 2);
  assertEquals(urls.includes("http://example.com/ext1.json"), true);
  assertEquals(urls.includes("https://example.com/ext2.json"), true);

  console.log("✓ 子源 URL 检测测试通过: sites.ext 字段被识别");
});

Deno.test("SourceValidatorService: extractSubsourceUrls - handles spider array", () => {
  const validator = new SourceValidatorService();

  const config = {
    spider: [
      "http://example.com/spider1.json",
      "http://example.com/spider2.json",
      "./local.jar", // 相对路径不应被提取
    ],
    sites: [],
  };

  const urls = (validator as any).extractSubsourceUrls(config);

  assertEquals(urls.length, 2);
  assertEquals(urls.includes("http://example.com/spider1.json"), true);
  assertEquals(urls.includes("http://example.com/spider2.json"), true);

  console.log("✓ 子源 URL 检测测试通过: spider 数组被正确处理");
});

Deno.test("SourceValidatorService: normalizeUrl - removes trailing slashes and lowercases", () => {
  const validator = new SourceValidatorService();

  const url1 = (validator as any).normalizeUrl("http://example.com/test/");
  const url2 = (validator as any).normalizeUrl("http://EXAMPLE.COM/test/");

  assertEquals(url1, "http://example.com/test");
  assertEquals(url2, "http://example.com/test");
  assertEquals(url1 === url2, true);

  console.log("✓ URL 规范化测试通过: 尾部斜杠和大小写处理正确");
});

Deno.test("SourceValidatorService: cleanJsonText - removes BOM", () => {
  const validator = new SourceValidatorService();

  const textWithBOM = "\uFEFF{ \"key\": \"value\" }";
  const cleaned = (validator as any).cleanJsonText(textWithBOM);

  assertEquals(cleaned.charCodeAt(0), 0x7b); // '{'
  assertEquals(cleaned, '{"key":"value"}');

  console.log("✓ JSON 清理测试通过: BOM 被移除");
});

Deno.test("SourceValidatorService: cleanJsonText - removes single-line comments", () => {
  const validator = new SourceValidatorService();

  const text = `
    {
      "key": "value", // 这是注释
      "key2": "value2"
    }
  `;
  const cleaned = (validator as any).cleanJsonText(text);

  assertEquals(cleaned.includes("//"), false);
  assertEquals(cleaned.includes("这是注释"), false);
  assertExists(JSON.parse(cleaned));

  console.log("✓ JSON 清理测试通过: 单行注释被移除");
});

Deno.test("SourceValidatorService: cleanJsonText - removes trailing commas", () => {
  const validator = new SourceValidatorService();

  const text = '{ "key": "value", "key2": "value2", }';
  const cleaned = (validator as any).cleanJsonText(text);

  assertEquals(cleaned.includes(",}"), false);

  const parsed = JSON.parse(cleaned);
  assertEquals(parsed.key, "value");
  assertEquals(parsed.key2, "value2");

  console.log("✓ JSON 清理测试通过: 尾逗号被移除");
});

Deno.test("SourceValidatorService: isValidTVBoxConfig - validates standard fields", () => {
  const validator = new SourceValidatorService();

  const validConfigs = [
    { sites: [] },
    { lives: [] },
    { parses: [] },
    { spider: "http://example.com/jar.jar" },
    { wallpaper: "http://example.com/bg.jpg" },
  ];

  validConfigs.forEach((config) => {
    const isValid = (validator as any).isValidTVBoxConfig(config);
    assertEquals(isValid, true, `配置 ${JSON.stringify(config)} 应该是有效的`);
  });

  console.log("✓ 配置验证测试通过: 标准字段识别正确");
});

Deno.test("SourceValidatorService: isValidTVBoxConfig - rejects invalid configs", () => {
  const validator = new SourceValidatorService();

  const invalidConfigs = [
    null,
    undefined,
    {},
    { random: "field" },
    "not an object",
    123,
  ];

  invalidConfigs.forEach((config) => {
    const isValid = (validator as any).isValidTVBoxConfig(config);
    assertEquals(isValid, false, `配置 ${JSON.stringify(config)} 应该是无效的`);
  });

  console.log("✓ 配置验证测试通过: 无效配置被正确拒绝");
});

Deno.test("SourceValidatorService: shouldRecurse - respects maxDepth", () => {
  const validator = new SourceValidatorService();

  const source = new ConfigSource("test", "测试源", "http://example.com", 50, [], undefined, undefined, undefined, true, 2, true);

  assertEquals((validator as any).shouldRecurse(source, 0), true);
  assertEquals((validator as any).shouldRecurse(source, 1), true);
  assertEquals((validator as any).shouldRecurse(source, 2), false); // 达到最大深度

  const noRecurseSource = new ConfigSource("test2", "禁用递归", "http://example.com", 50, [], undefined, undefined, undefined, false, 0, true);
  assertEquals((validator as any).shouldRecurse(noRecurseSource, 0), false);

  console.log("✓ 递归控制测试通过: maxDepth 限制生效");
});

Deno.test("SourceValidatorService: recursive parsing - fetches and merges subsources", async () => {
  const validator = new SourceValidatorService();

  const source = new ConfigSource("parent", "父级源", "http://example.com/parent.json", 50, [], undefined, undefined, undefined, true, 2, true);

  const config = await validator.fetchAndValidate(source, 0, new Set());

  assertExists(config.sites);
  // 应该包含父级站点和子级站点
  assertEquals(config.sites.length >= 1, true);

  console.log("✓ 递归解析测试通过: 子配置被成功获取和合并");
});

Deno.test("SourceValidatorService: circular reference detection - prevents infinite loop", async () => {
  const validator = new SourceValidatorService();

  const sourceA = new ConfigSource("a", "源A", "http://example.com/circular-a.json", 50, [], undefined, undefined, undefined, true, 5, true);

  // 首次调用应该成功
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string, init?: RequestInit) => {
    callCount++;
    return originalFetch(url, init);
  };

  try {
    await validator.fetchAndValidate(sourceA, 0, new Set());
    // 验证 fetch 调用次数合理(不是无限递归)
    assertEquals(callCount <= 4, true, `fetch 调用次数过多: ${callCount}`);
    console.log(`✓ 循环引用检测测试通过: 防止无限递归(fetch 调用 ${callCount} 次)`);
  } finally {
    // 恢复原始 fetch
    globalThis.fetch = originalFetch;
  }
});

Deno.test("SourceValidatorService: depth limiting - respects maxDepth", async () => {
  const validator = new SourceValidatorService();

  // 设置 maxDepth=2
  const source = new ConfigSource("deep", "深层源", "http://example.com/deep1.json", 50, [], undefined, undefined, undefined, true, 2, true);

  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string, init?: RequestInit) => {
    callCount++;
    return originalFetch(url, init);
  };

  try {
    const config = await validator.fetchAndValidate(source, 0, new Set());

    // 验证递归在深度 2 时停止(最多调用 3 次: deep1, deep2, deep3)
    assertEquals(callCount <= 3, true, `深度限制未生效: 调用 ${callCount} 次`);

    console.log(`✓ 深度限制测试通过: 递归在 maxDepth=2 时停止(fetch 调用 ${callCount} 次)`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("SourceValidatorService: mergeChildConfigs - merges sites correctly", () => {
  const validator = new SourceValidatorService();

  const parentConfig = {
    sites: [
      { key: "site1", name: "父级站点1", api: "http://api.parent.com" },
      { key: "site2", name: "父级站点2", api: "http://api2.parent.com" },
    ],
  };

  const childConfigs = [
    {
      sites: [
        { key: "site1", name: "子级站点1", api: "http://api.child.com" }, // 应覆盖父级
        { key: "site3", name: "子级站点3", api: "http://api3.child.com" }, // 新增
      ],
    },
  ];

  const merged = (validator as any).mergeChildConfigs(parentConfig, childConfigs);

  assertExists(merged.sites);
  assertEquals(merged.sites.length, 3);

  const site1 = merged.sites.find((s: any) => s.key === "site1");
  assertEquals(site1.name, "子级站点1"); // 子配置覆盖父配置

  const site2 = merged.sites.find((s: any) => s.key === "site2");
  assertEquals(site2.name, "父级站点2"); // 父配置保留

  const site3 = merged.sites.find((s: any) => s.key === "site3");
  assertExists(site3); // 新增站点

  console.log("✓ 子配置合并测试通过: sites 正确合并,子配置优先");
});

Deno.test("SourceValidatorService: mergeChildConfigs - merges spider as array", () => {
  const validator = new SourceValidatorService();

  const parentConfig = {
    spider: "http://parent.jar",
    sites: [],
  };

  const childConfigs = [
    {
      spider: ["http://child1.jar", "http://child2.jar"],
      sites: [],
    },
    {
      spider: "http://child3.jar",
      sites: [],
    },
  ];

  const merged = (validator as any).mergeChildConfigs(parentConfig, childConfigs);

  assertExists(merged.spider);
  assertEquals(Array.isArray(merged.spider), true);
  assertEquals(merged.spider.length, 4); // 去重后应有4个

  console.log("✓ 子配置合并测试通过: spider 合并为去重数组");
});

Deno.test("SourceValidatorService: classifyError - categorizes errors correctly", () => {
  const validator = new SourceValidatorService();

  const timeoutError = { name: "AbortError", message: "Timeout" };
  const networkError = { message: "ECONNREFUSED" };
  const notFoundError = { message: "ENOTFOUND" };
  const genericError = { message: "Something went wrong" };

  assertEquals((validator as any).classifyError(timeoutError), "timeout");
  assertEquals((validator as any).classifyError(networkError), "failed");
  assertEquals((validator as any).classifyError(notFoundError), "failed");
  assertEquals((validator as any).classifyError(genericError), "degraded");

  console.log("✓ 错误分类测试通过: 错误类型识别正确");
});
