/**
 * 递归解析功能验证脚本
 *
 * 验证点:
 * 1. fetchAndValidate 支持递归参数
 * 2. spider 字段识别为子源 URL
 * 3. sites.ext 字段识别为子源 URL
 * 4. 深度控制生效
 * 5. 子配置合并到父配置
 */

import { ConfigSource } from "../src/domain/entities/config-source.entity.ts";
import { SourceValidatorService } from "../src/domain/services/source-validator.service.ts";

// 测试配置
const testConfig = {
  spider: "https://example.com/spider.json", // 应该被识别为子源
  sites: [
    {
      key: "site1",
      name: "Site 1",
      type: 0,
      api: "http://api.example.com",
      ext: "https://example.com/ext.json", // 应该被识别为子源
    },
    {
      key: "site2",
      name: "Site 2",
      type: 1,
      api: "http://api2.example.com",
      ext: "./local.ext", // 不应该被识别(相对路径)
    },
  ],
  lives: [
    {
      name: "CCTV-1",
      group: "央视",
      urls: ["http://live.example.com/cctv1.m3u8"],
    },
  ],
};

// 验证函数
async function validateRecursiveLogic() {
  console.log("=== 递归解析逻辑验证 ===\n");

  const validator = new SourceValidatorService();

  // 验证 1: extractSubsourceUrls 方法
  console.log("1. 验证子源 URL 检测逻辑");

  // 使用反射访问私有方法(仅用于测试)
  const extractUrls = validator["extractSubsourceUrls"].bind(validator);
  const urls = extractUrls(testConfig);

  console.log(`   检测到 ${urls.length} 个子源 URL:`);
  urls.forEach((url, i) => {
    console.log(`   ${i + 1}. ${url}`);
  });

  const expectedUrls = [
    "https://example.com/spider.json",
    "https://example.com/ext.json",
  ];

  const hasCorrectUrls =
    urls.length === 2 &&
    urls.includes(expectedUrls[0]) &&
    urls.includes(expectedUrls[1]);

  console.log(`   ${hasCorrectUrls ? "✅" : "❌"} URL 检测正确\n`);

  // 验证 2: shouldRecurse 边界条件
  console.log("2. 验证深度控制逻辑");

  const shouldRecurse = validator["shouldRecurse"].bind(validator);

  const testCases = [
    { source: { maxDepth: 0 }, depth: 0, expected: false, desc: "maxDepth=0 禁用递归" },
    { source: { maxDepth: null }, depth: 0, expected: true, desc: "maxDepth=null 默认深度2" },
    { source: { maxDepth: undefined }, depth: 0, expected: true, desc: "maxDepth=undefined 默认深度2" },
    { source: { maxDepth: 1 }, depth: 0, expected: true, desc: "maxDepth=1, depth=0 继续递归" },
    { source: { maxDepth: 1 }, depth: 1, expected: false, desc: "maxDepth=1, depth=1 停止递归" },
    { source: { maxDepth: 2 }, depth: 1, expected: true, desc: "maxDepth=2, depth=1 继续递归" },
    { source: { maxDepth: 2 }, depth: 2, expected: false, desc: "maxDepth=2, depth=2 停止递归" },
  ];

  let allPassed = true;
  testCases.forEach((testCase) => {
    const mockSource = { isRecursive: true, ...testCase.source };
    const result = shouldRecurse(mockSource, testCase.depth);
    const passed = result === testCase.expected;
    allPassed = allPassed && passed;
    console.log(
      `   ${passed ? "✅" : "❌"} ${testCase.desc}: ${result} (期望: ${testCase.expected})`
    );
  });

  console.log(`   ${allPassed ? "✅" : "❌"} 深度控制逻辑正确\n`);

  // 验证 3: mergeChildConfigs 合并策略
  console.log("3. 验证子配置合并逻辑");

  const mergeConfigs = validator["mergeChildConfigs"].bind(validator);

  const parentConfig = {
    sites: [
      { key: "site1", name: "Parent Site 1" },
      { key: "site2", name: "Parent Site 2" },
    ],
    lives: [
      { name: "Channel1", group: "Default" },
    ],
    spider: ["spider1.jar", "spider2.jar"],
  };

  const childConfig = {
    sites: [
      { key: "site1", name: "Child Site 1" }, // 应该覆盖父级
      { key: "site3", name: "Child Site 3" }, // 新增
    ],
    lives: [
      { name: "Channel1", group: "Child Group" }, // 应该覆盖父级
      { name: "Channel2", group: "Child Group" }, // 新增
    ],
    spider: ["spider2.jar", "spider3.jar"], // 部分重叠
  };

  const merged = mergeConfigs(parentConfig, [childConfig]);

  // 验证 sites 合并
  const sitesCorrect =
    merged.sites.length === 3 &&
    merged.sites.find((s: any) => s.key === "site1")?.name === "Child Site 1" && // 子级覆盖
    merged.sites.find((s: any) => s.key === "site2")?.name === "Parent Site 2" && // 父级保留
    merged.sites.find((s: any) => s.key === "site3")?.name === "Child Site 3"; // 子级新增

  console.log(
    `   ${sitesCorrect ? "✅" : "❌"} sites 合并正确 (3个站点,子级覆盖父级)`
  );

  // 验证 lives 合并
  const livesCorrect =
    merged.lives.length === 2 &&
    merged.lives.find((l: any) => l.name === "Channel1")?.group === "Child Group" && // 子级覆盖
    merged.lives.find((l: any) => l.name === "Channel2")?.group === "Child Group"; // 子级新增

  console.log(
    `   ${livesCorrect ? "✅" : "❌"} lives 合并正确 (2个频道,子级覆盖父级)`
  );

  // 验证 spider 合并
  const spiderCorrect =
    Array.isArray(merged.spider) &&
    merged.spider.length === 3 &&
    merged.spider.includes("spider1.jar") &&
    merged.spider.includes("spider2.jar") &&
    merged.spider.includes("spider3.jar");

  console.log(
    `   ${spiderCorrect ? "✅" : "❌"} spider 合并正确 (3个爬虫,去重)`
  );

  const mergeCorrect = sitesCorrect && livesCorrect && spiderCorrect;
  console.log(`   ${mergeCorrect ? "✅" : "❌"} 子配置合并逻辑正确\n`);

  // 总体结果
  console.log("=== 验证结果 ===");
  const allCorrect = hasCorrectUrls && allPassed && mergeCorrect;
  console.log(`${allCorrect ? "✅ 所有验证通过" : "❌ 部分验证失败"}\n`);

  return allCorrect;
}

// 运行验证
if (import.meta.main) {
  validateRecursiveLogic()
    .then((success) => {
      Deno.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("验证过程出错:", error);
      Deno.exit(1);
    });
}
