/**
 * 聚合配置用例
 */
import { ConfigSource } from "../../domain/entities/config-source.entity.ts";
import { CacheManagerService } from "../services/cache-manager.service.ts";
import { SourceValidatorService } from "../../domain/services/source-validator.service.ts";

// TVBox 配置类型接口
export interface SiteConfig {
  key?: string;
  name: string;
  type?: string;
  api?: string;
  searchable?: number;
  quickSearch?: number;
  filterable?: number;
  [key: string]: any;
}

export interface LiveConfig {
  group?: string;
  name: string;
  logo?: string;
  urls?: string[];
  [key: string]: any;
}

export interface ParseConfig {
  name: string;
  type?: string;
  url: string;
  [key: string]: any;
}

export interface TVBoxConfig {
  sites?: SiteConfig[];
  lives?: LiveConfig[];
  parses?: ParseConfig[];
  spider?: string | string[];
  wallpaper?: string;
}

export interface AggregateOptions {
  maxSources?: number;
  minPriority?: number;
  excludeFailed?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  cacheStrategy?: "aggressive" | "balanced" | "minimal";
  includeContent?: boolean;
  /**
   * 是否启用递归解析,默认为 true
   * 当设置为 false 时,只获取第一层配置,不解析子源
   */
  enableRecursive?: boolean;
  /**
   * 覆盖源配置中的 maxDepth 设置
   * 如果指定,将替代 sources.json 中定义的 maxDepth 值
   */
  maxDepthOverride?: number;
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
  merged_config?: TVBoxConfig;
}

export class AggregateConfigUseCase {
  constructor(
    private cacheService: CacheManagerService
  ) {}

  async execute(options: AggregateOptions = {}): Promise<AggregatedConfig> {
    const startTime = Date.now();

    // 默认启用配置合并,返回完整的 TVBox JSON 配置内容
    const effectiveOptions = {
      ...options,
      excludeFailed: options.excludeFailed ?? false,
      includeContent: options.includeContent ?? true,
      /**
       * 默认启用递归解析,符合用户"真正解析"的意图
       * 仅当显式传递 false 时禁用
       */
      enableRecursive: options.enableRecursive ?? true,
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

    // 4. 构建聚合结果(直接返回源列表,包含状态)
    // 按源优先级降序排序,确保响应中的 sources 数组也按优先级排列
    const sourcesByPriority = filteredSources
      .sort((a, b) => b.priority - a.priority);

    const result: AggregatedConfig = {
      version: new Date().toISOString().split("T")[0],
      sources: sourcesByPriority.map((source) => ({
        name: source.name,
        url: source.url,
        priority: source.priority,
        status: source.status || "unknown", // 包含实际状态
      })),
      total: filteredSources.length,
      healthySources: filteredSources.filter((s) => s.status === "healthy").length,
      generatedAt: new Date(),
      cacheTTL: 3600,
    };

    // 5. 条件性合并配置内容
    if (effectiveOptions.includeContent) {
      try {
        const validator = new SourceValidatorService();

        // 处理递归控制参数
        let sourcesToFetch = sourcesByPriority;

        // 如果禁用递归,临时禁用所有源的递归设置
        if (effectiveOptions.enableRecursive === false) {
          console.log("[Aggregate] Recursive parsing disabled by client request");
          sourcesToFetch = sourcesByPriority.map(source => {
            // 创建源的副本并禁用递归
            const modifiedSource = Object.assign(Object.create(Object.getPrototypeOf(source)), source);
            modifiedSource.isRecursive = false;
            return modifiedSource;
          });
        }

        // 如果指定了 maxDepthOverride,覆盖源的 maxDepth 设置
        if (effectiveOptions.maxDepthOverride !== undefined) {
          console.log(`[Aggregate] Max depth override: ${effectiveOptions.maxDepthOverride}`);
          sourcesToFetch = sourcesToFetch.map(source => {
            // 创建源的副本并覆盖最大深度
            const modifiedSource = Object.assign(Object.create(Object.getPrototypeOf(source)), source);
            modifiedSource.maxDepth = effectiveOptions.maxDepthOverride!;
            return modifiedSource;
          });
        }

        // 使用处理后的 sources 数组,确保高优先级源的配置优先保留
        const configs = await this.fetchValidConfigs(sourcesToFetch, validator);
        if (configs.length > 0) {
          result.merged_config = this.mergeConfigs(configs);
          console.log(`[Aggregate] Merged ${configs.length} configs`);
        }
      } catch (error) {
        console.error(`[Aggregate] Failed to fetch configs:`, error.message);
      }
    }

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

  private mergeConfigs(configs: any[]): TVBoxConfig {
    const merged: TVBoxConfig = {};

    // 合并 sites（按 key 去重）
    const sitesMap = new Map<string, SiteConfig>();
    for (const config of configs) {
      if (config.sites && Array.isArray(config.sites)) {
        for (const site of config.sites) {
          const key = site.key || site.name;
          if (!sitesMap.has(key)) {
            sitesMap.set(key, site);
          }
        }
      }
    }
    if (sitesMap.size > 0) {
      merged.sites = Array.from(sitesMap.values());
    }

    // 合并 lives（按 name 去重）
    const livesMap = new Map<string, LiveConfig>();
    for (const config of configs) {
      if (config.lives && Array.isArray(config.lives)) {
        for (const live of config.lives) {
          if (!livesMap.has(live.name)) {
            livesMap.set(live.name, live);
          }
        }
      }
    }
    if (livesMap.size > 0) {
      merged.lives = Array.from(livesMap.values());
    }

    // 合并 parses（按 name 去重）
    const parsesMap = new Map<string, ParseConfig>();
    for (const config of configs) {
      if (config.parses && Array.isArray(config.parses)) {
        for (const parse of config.parses) {
          if (!parsesMap.has(parse.name)) {
            parsesMap.set(parse.name, parse);
          }
        }
      }
    }
    if (parsesMap.size > 0) {
      merged.parses = Array.from(parsesMap.values());
    }

    // spider 和 wallpaper 使用第一个有效值
    for (const config of configs) {
      if (config.spider && !merged.spider) {
        merged.spider = config.spider;
      }
      if (config.wallpaper && !merged.wallpaper) {
        merged.wallpaper = config.wallpaper;
      }
    }

    return merged;
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
