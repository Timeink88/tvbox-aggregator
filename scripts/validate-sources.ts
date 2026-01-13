/**
 * 配置源验证脚本
 */

import { ConfigSource } from "../src/domain/entities/config-source.entity.ts";
import { SourceValidatorService } from "../src/domain/services/source-validator.service.ts";

interface ValidationResult {
  sourceId: string;
  name: string;
  url: string;
  status: string;
  responseTime: number;
  score: number;
  error?: string;
}

interface HealthReport {
  timestamp: string;
  total: number;
  healthy: number;
  degraded: number;
  failed: number;
  avgResponseTime: number;
  results: ValidationResult[];
}

async function main() {
  console.log("🔍 开始验证配置源...\n");

  // 1. 加载源配置
  const sources = await loadSources();
  console.log(`📋 加载了 ${sources.length} 个配置源\n`);

  // 2. 验证每个源
  const validator = new SourceValidatorService();
  const results: ValidationResult[] = [];

  for (const source of sources) {
    console.log(`验证: ${source.name} (${source.url})`);

    const startTime = Date.now();

    try {
      const config = await validator.fetchAndValidate(source);
      const responseTime = Date.now() - startTime;

      results.push({
        sourceId: source.id,
        name: source.name,
        url: source.url,
        status: "healthy",
        responseTime,
        score: source.calculateHealthScore(),
      });

      console.log(
        `  ✅ 有效 (${responseTime}ms, 评分: ${source.calculateHealthScore().toFixed(2)})\n`
      );
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      results.push({
        sourceId: source.id,
        name: source.name,
        url: source.url,
        status: source.status,
        responseTime,
        score: source.calculateHealthScore(),
        error: error.message,
      });

      console.log(
        `  ❌ 失败 (${source.status}, ${responseTime}ms)\n`
      );
    }
  }

  // 3. 生成报告
  const healthyCount = results.filter((r) => r.status === "healthy").length;
  const degradedCount = results.filter((r) => r.status === "degraded").length;
  const failedCount = results.filter(
    (r) => r.status === "failed" || r.status === "timeout"
  ).length;
  const avgResponseTime =
    results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

  const report: HealthReport = {
    timestamp: new Date().toISOString(),
    total: results.length,
    healthy: healthyCount,
    degraded: degradedCount,
    failed: failedCount,
    avgResponseTime: Math.round(avgResponseTime),
    results,
  };

  // 4. 保存报告
  const reportsDir = "reports";
  try {
    await Deno.mkdir(reportsDir, { recursive: true });
  } catch {
    // 目录已存在
  }

  const reportPath = `${reportsDir}/health-${Date.now()}.json`;
  await Deno.writeTextFile(
    reportPath,
    JSON.stringify(report, null, 2)
  );

  // 5. 输出摘要
  console.log("=" .repeat(60));
  console.log("📊 验证摘要");
  console.log("=" .repeat(60));
  console.log(`总数: ${report.total}`);
  console.log(`✅ 健康: ${report.healthy} (${((report.healthy / report.total) * 100).toFixed(1)}%)`);
  console.log(`⚠️  降级: ${report.degraded} (${((report.degraded / report.total) * 100).toFixed(1)}%)`);
  console.log(`❌ 失败: ${report.failed} (${((report.failed / report.total) * 100).toFixed(1)}%)`);
  console.log(`⏱️  平均响应时间: ${report.avgResponseTime}ms`);
  console.log("=" .repeat(60));
  console.log(`\n📄 详细报告已保存: ${reportPath}\n`);

  // 6. 推荐的源
  const recommendedSources = results
    .filter((r) => r.status === "healthy" && r.score > 0.7)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (recommendedSources.length > 0) {
    console.log("🌟 推荐的高质量源（前10）:");
    console.log("-" .repeat(60));
    recommendedSources.forEach((r, i) => {
      console.log(
        `${i + 1}. ${r.name} (评分: ${r.score.toFixed(2)}, 响应: ${r.responseTime}ms)`
      );
    });
    console.log();
  }
}

async function loadSources(): Promise<ConfigSource[]> {
  try {
    const content = await Deno.readTextFile("config/sources.json");
    const sourcesData = JSON.parse(content);

    return sourcesData.map(
      (data: any) =>
        new ConfigSource(
          data.id,
          data.name,
          data.url,
          data.priority,
          data.tags,
          undefined,
          undefined,
          undefined,
          data.isRecursive,
          data.maxDepth,
          data.enabled
        )
    );
  } catch (error) {
    console.error("❌ 加载源配置失败:", error);
    return [];
  }
}

await main();
