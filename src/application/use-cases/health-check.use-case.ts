/**
 * 健康检查用例
 */
import { ConfigSource } from "../../domain/entities/config-source.entity.ts";
import { SourceValidatorService } from "../../domain/services/source-validator.service.ts";
import { SourceStatus } from "../../domain/entities/config-source.entity.ts";

export interface HealthCheckResult {
  sourceId: string;
  sourceName: string;
  status: SourceStatus;
  responseTime: number;
  lastChecked: Date;
  score: number;
}

export interface SystemHealthReport {
  total: number;
  healthy: number;
  degraded: number;
  failed: number;
  lastChecked: Date;
  sources: HealthCheckResult[];
}

export class HealthCheckUseCase {
  private validator: SourceValidatorService;

  constructor() {
    this.validator = new SourceValidatorService();
  }

  /**
   * 检查所有源的健康状态
   */
  async checkAllSources(): Promise<SystemHealthReport> {
    const startTime = Date.now();

    // 1. 加载源配置
    const sources = await this.loadSources();

    // 2. 并发检查健康状态
    const results = await this.checkSourcesConcurrently(sources);

    // 3. 生成报告
    const report: SystemHealthReport = {
      total: results.length,
      healthy: results.filter((r) => r.status === SourceStatus.HEALTHY)
        .length,
      degraded: results.filter((r) => r.status === SourceStatus.DEGRADED)
        .length,
      failed: results.filter(
        (r) =>
          r.status === SourceStatus.FAILED ||
          r.status === SourceStatus.TIMEOUT
      ).length,
      lastChecked: new Date(),
      sources: results,
    };

    const duration = Date.now() - startTime;
    console.log(
      `[HealthCheck] Completed in ${duration}ms, healthy: ${report.healthy}/${report.total}`
    );

    return report;
  }

  /**
   * 并发检查源
   */
  private async checkSourcesConcurrently(
    sources: ConfigSource[]
  ): Promise<HealthCheckResult[]> {
    const concurrency = 10;
    const results: HealthCheckResult[] = [];

    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async (source) => {
          const startTime = Date.now();
          try {
            const config = await this.validator.fetchAndValidate(source);
            return {
              sourceId: source.id,
              sourceName: source.name,
              status: SourceStatus.HEALTHY,
              responseTime: Date.now() - startTime,
              lastChecked: new Date(),
              score: source.calculateHealthScore(),
            };
          } catch (error) {
            return {
              sourceId: source.id,
              sourceName: source.name,
              status: source.status,
              responseTime: Date.now() - startTime,
              lastChecked: new Date(),
              score: source.calculateHealthScore(),
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  /**
   * 加载源配置
   */
  private async loadSources(): Promise<ConfigSource[]> {
    try {
      const content = await Deno.readTextFile(
        new URL("../../../config/sources.json", import.meta.url)
      );
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
      console.error(`[LoadSources] Error:`, error);
      return [];
    }
  }
}
