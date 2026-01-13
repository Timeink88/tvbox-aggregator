/**
 * 聚合配置用例
 */
import { ConfigSource } from "../../domain/entities/config-source.entity.ts";
import { CacheManagerService } from "../services/cache-manager.service.ts";
import { SourceValidatorService } from "../../domain/services/source-validator.service.ts";

export interface AggregateOptions {
  maxSources?: number;
  minPriority?: number;
  excludeFailed?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  cacheStrategy?: "aggressive" | "balanced" | "minimal";
}

export interface AggregatedConfig {
  version: string;
  sources: Array<{
    name: string;
    url: string;
    icon?: string;
    priority: number;
    status: string;
  }>;
  total: number;
  healthySources: number;
  generatedAt: Date;
  cacheTTL: number;
}

export class AggregateConfigUseCase {
  constructor(
    private cacheService: CacheManagerService
  ) {}

  async execute(options: AggregateOptions = {}): Promise<AggregatedConfig> {
    const startTime = Date.now();

    // 默认不排除失败的源，确保返回所有启用的源及其状态
    const effectiveOptions = {
      ...options,
      excludeFailed: options.excludeFailed ?? false,
    };

    // 1. 尝试从缓存获取
    const cacheKey = this.generateCacheKey(effectiveOptions);
    const cached = await this.cacheService.get<AggregatedConfig>(cacheKey);
    if (cached) {
      console.log(`[Cache Hit] Returning cached config, total: ${cached.total}`);
      return cached;
    }

    // 2. 加载源配置
    const sources = await this.loadSources();

    // 3. 应用过滤规则（获取所有启用的源）
    const filteredSources = this.applyFilters(sources, effectiveOptions);

    // 4. 构建聚合结果（直接返回源列表，包含状态）
    const result: AggregatedConfig = {
      version: new Date().toISOString().split("T")[0],
      sources: filteredSources.map((source) => ({
        name: source.name,
        url: source.url,
        icon: source.icon,
        priority: source.priority,
        status: source.status || "unknown", // 包含实际状态
      })),
      total: filteredSources.length,
      healthySources: filteredSources.filter((s) => s.status === "healthy").length,
      generatedAt: new Date(),
      cacheTTL: 3600,
    };

    // 6. 写入缓存
    await this.cacheService.set(cacheKey, result, 3600);

    const duration = Date.now() - startTime;
    console.log(`[Aggregate] Completed in ${duration}ms, sources: ${result.total}`);

    return result;
  }

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
            undefined, // status will be determined by health check
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

  private applyFilters(
    sources: ConfigSource[],
    options: AggregateOptions
  ): ConfigSource[] {
    let filtered = sources;

    // 只启用的源
    filtered = filtered.filter((s) => s.enabled);

    // 排除失败的源
    if (options.excludeFailed !== false) {
      filtered = filtered.filter((s) => s.isAvailable());
    }

    // 最小优先级
    if (options.minPriority !== undefined) {
      filtered = filtered.filter((s) => s.priority >= options.minPriority!);
    }

    // 包含标签
    if (options.includeTags?.length) {
      filtered = filtered.filter((s) =>
        options.includeTags!.some((tag) => s.tags.includes(tag))
      );
    }

    // 排除标签
    if (options.excludeTags?.length) {
      filtered = filtered.filter(
        (s) => !options.excludeTags!.some((tag) => s.tags.includes(tag))
      );
    }

    // 最大源数量（按优先级排序）
    if (options.maxSources) {
      filtered = filtered
        .sort((a, b) => b.priority - a.priority)
        .slice(0, options.maxSources);
    }

    return filtered;
  }

  private async fetchValidConfigs(
    sources: ConfigSource[],
    validator: SourceValidatorService
  ): Promise<any[]> {
    const concurrency = 10;
    const results: any[] = [];

    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async (source) => {
          try {
            return await validator.fetchAndValidate(source);
          } catch (error) {
            console.error(`[Fetch] Failed for ${source.name}:`, error.message);
            return null;
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  private generateCacheKey(options: AggregateOptions): string {
    const hash = this.hashObject(options);
    return `aggregated:${hash}`;
  }

  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
