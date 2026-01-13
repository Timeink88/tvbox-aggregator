/**
 * 源验证服务
 */
import { ConfigSource, SourceStatus } from "../entities/config-source.entity.ts";

export class SourceValidatorService {
  private readonly USER_AGENT = "TVBox-Fetcher/2.0";
  private readonly QUICK_TIMEOUT = 5000; // 快速验证超时 5秒
  private readonly FULL_TIMEOUT = 15000; // 完整验证超时 15秒

  /**
   * 获取并验证源配置(支持递归解析子源)
   * @param source 配置源
   * @param currentDepth 当前递归深度(从0开始)
   * @param visitedUrls 已访问URL集合(用于循环引用检测)
   * @param path 当前解析路径(用于调试和循环引用追踪)
   */
  async fetchAndValidate(
    source: ConfigSource,
    currentDepth: number = 0,
    visitedUrls: Set<string> = new Set<string>(),
    path: string[] = []
  ): Promise<any> {
    // 规范化 URL
    const normalizedUrl = this.normalizeUrl(source.url);

    // URL 去重检查 - 防止循环引用
    if (visitedUrls.has(normalizedUrl)) {
      console.warn(
        `[Circular Reference] Detected: ${normalizedUrl}\n` +
        `  Path: ${path.join(" -> ")} -> ${normalizedUrl}\n` +
        `  Skipping to prevent infinite recursion`
      );
      throw new Error(`Circular reference detected: ${normalizedUrl}`);
    }

    // 标记为已访问
    visitedUrls.add(normalizedUrl);

    // 更新路径
    const currentPath = [...path, normalizedUrl];

    const startTime = Date.now();

    try {
      // 两阶段验证(简化版)
      const result = await this.validateWithOptimizedStages(
        source,
        currentDepth,
        visitedUrls,
        currentPath
      );

      const responseTime = Date.now() - startTime;
      source.updateStatus(result.status, responseTime);

      console.log(
        `[SourceValidator] ${source.name}: ${result.status} (${responseTime}ms)`
      );

      // 调试日志：检查result.config
      console.debug(
        `[SourceValidator] ${source.name}: result.config =`,
        result.config ? "EXISTS" : "NULL/UNDEFINED",
        result.config ? `(keys: ${Object.keys(result.config).join(", ")})` : ""
      );

      // HEALTHY 状态或有配置内容的 DEGRADED 状态都返回配置
      if (result.status === SourceStatus.HEALTHY && result.config) {
        return result.config;
      }

      // DEGRADED 状态如果有配置内容也返回（例如：配置不完整但仍有价值）
      if (result.status === SourceStatus.DEGRADED && result.config) {
        console.log(
          `[SourceValidator] ${source.name}: Returning degraded config`
        );
        return result.config;
      }

      throw new Error(`Source validation failed: ${result.status}`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const status = this.classifyError(error);
      source.updateStatus(status, responseTime);

      console.log(
        `[SourceValidator] ${source.name}: ${status} (${responseTime}ms) - ${error.message}`
      );

      throw error;
    }
  }

  /**
   * 优化的两阶段验证流程(支持递归解析)
   */
  private async validateWithOptimizedStages(
    source: ConfigSource,
    currentDepth: number,
    visitedUrls: Set<string>,
    path: string[]
  ): Promise<{
    status: SourceStatus;
    config?: any;
  }> {
    // 阶段1: 快速 GET 请求（不验证内容）
    const quickResult = await this.quickGetRequest(source.url);
    if (!quickResult.success) {
      // 根据错误类型判定状态
      return {
        status: quickResult.isTimeout ? SourceStatus.TIMEOUT : SourceStatus.FAILED
      };
    }

    // 阶段2: 完整内容验证
    try {
      const config = await this.fullContentRequest(
        source.url,
        source,
        currentDepth,
        visitedUrls,
        path
      );
      if (config && this.isValidTVBoxConfig(config)) {
        return { status: SourceStatus.HEALTHY, config };
      } else {
        // DEGRADED 状态也返回配置（即使不完整）
        return { status: SourceStatus.DEGRADED, config };
      }
    } catch (error) {
      // 如果快速请求成功，但完整请求失败，标记为 degraded
      return { status: SourceStatus.DEGRADED };
    }
  }

  /**
   * 快速 GET 请求（仅检查可达性）
   */
  private async quickGetRequest(url: string): Promise<{
    success: boolean;
    isTimeout: boolean;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.QUICK_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": this.USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // 2xx/3xx = 成功, 4xx = 可能临时问题, 5xx = 失败
      return {
        success: response.ok || response.status < 500,
        isTimeout: false
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        success: false,
        isTimeout: error.name === "AbortError"
      };
    }
  }

  /**
   * 完整内容请求(支持递归解析子源)
   */
  private async fullContentRequest(
    url: string,
    source: ConfigSource,
    currentDepth: number,
    visitedUrls: Set<string>,
    path: string[]
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FULL_TIMEOUT);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": this.USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();

      // 清理并解析JSON（增强容错性）
      let config;
      try {
        // 第一次尝试：直接解析
        config = JSON.parse(text);
      } catch {
        try {
          // 第二次尝试：清理后解析
          const clean = this.cleanJsonText(text);
          config = JSON.parse(clean);
        } catch {
          // 第三次尝试：去除 BOM 和其他字符后解析
          const cleaned = text
            .replace(/^\uFEFF/, "") // 去除 BOM
            .replace(/\/\*[\s\S]*?\*\//g, "") // 去除多行注释
            .replace(/^\s+|\s+$/g, ""); // 去除首尾空白
          config = JSON.parse(this.cleanJsonText(cleaned));
        }
      }

      // 检测并处理多仓索引格式（urls[] 格式）
      if (Array.isArray(config.urls) && config.urls.length > 0) {
        console.log(
          `[Multi-Repo Index] Detected ${config.urls.length} sub-sources, fetching recursively...`
        );

        // 自动递归解析多仓索引
        if (source.isRecursive && this.shouldRecurse(source, currentDepth)) {
          const mergedConfig = await this.fetchMultiRepoIndex(
            config.urls,
            source,
            currentDepth,
            visitedUrls,
            path
          );
          return mergedConfig;
        } else {
          // 如果未启用递归，返回空配置（DEGRADED）
          return { sites: [], lives: [], parses: [] };
        }
      }

      // 递归解析子源(如果启用)
      if (source.isRecursive && this.shouldRecurse(source, currentDepth)) {
        const mergedConfig = await this.fetchAndMergeSubsources(
          config,
          source,
          currentDepth,
          visitedUrls,
          path
        );
        return mergedConfig;
      }

      return config;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 错误分类
   */
  private classifyError(error: any): SourceStatus {
    if (error.name === "AbortError") {
      return SourceStatus.TIMEOUT;
    }
    // 网络错误
    if (error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("ENOTFOUND")) {
      return SourceStatus.FAILED;
    }
    // 其他错误
    return SourceStatus.DEGRADED;
  }

  /**
   * 验证是否为有效的TVBox配置
   */
  private isValidTVBoxConfig(obj: any): boolean {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    // 检查至少包含一个TVBox标准字段
    return (
      Array.isArray(obj.sites) ||
      Array.isArray(obj.lives) ||
      Array.isArray(obj.parses) ||
      typeof obj.spider === "string" ||
      typeof obj.wallpaper === "string"
    );
  }

  /**
   * 清理JSON文本（去除BOM、注释、尾逗号）
   */
  private cleanJsonText(text: string): string {
    // 去除BOM
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    // 去除单行注释
    const lines = text
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .filter((l) => l.trim());

    let joined = lines.join("");

    // 去除尾逗号
    joined = joined.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

    return joined;
  }

  /**
   * 规范化 URL (用于去重和循环引用检测)
   */
  private normalizeUrl(url: string): string {
    // 去除尾部斜杠
    let normalized = url.replace(/\/+$/, "");

    // 转换为小写(某些服务器可能忽略大小写)
    normalized = normalized.toLowerCase();

    // 移除常见的 URL 参数(如果需要)
    // normalized = normalized.split("?")[0];

    return normalized;
  }

  /**
   * 判断是否应该继续递归
   */
  private shouldRecurse(source: ConfigSource, currentDepth: number): boolean {
    // maxDepth 为 0 时禁用递归
    if (source.maxDepth === 0) {
      return false;
    }

    // maxDepth 为 null/undefined 时默认使用 2
    const effectiveMaxDepth = source.maxDepth ?? 2;

    // 当前深度小于最大深度时继续递归
    return currentDepth < effectiveMaxDepth;
  }

  /**
   * 从配置中提取子源URL
   */
  private extractSubsourceUrls(config: any): string[] {
    const urls: string[] = [];
    const urlPattern = /^https?:\/\//;

    // 1. 检测 spider 字段
    if (config.spider) {
      if (typeof config.spider === "string") {
        if (urlPattern.test(config.spider)) {
          urls.push(config.spider);
        }
      } else if (Array.isArray(config.spider)) {
        config.spider.forEach((s: string) => {
          if (typeof s === "string" && urlPattern.test(s)) {
            urls.push(s);
          }
        });
      }
    }

    // 2. 检测 sites 数组中的 ext 字段
    if (Array.isArray(config.sites)) {
      config.sites.forEach((site: any) => {
        if (site.ext && typeof site.ext === "string") {
          // 检查是否以 http:// 或 https:// 开头
          if (site.ext.startsWith("http://") || site.ext.startsWith("https://")) {
            urls.push(site.ext);
          }
        }
      });
    }

    // 去重
    return [...new Set(urls)];
  }

  /**
   * 处理多仓索引格式（urls[] 格式）
   * 例如: {"urls": [{"name": "源1", "url": "http://..."}, ...]}
   */
  private async fetchMultiRepoIndex(
    urlsArray: Array<{ name: string; url: string }>,
    parentSource: ConfigSource,
    currentDepth: number,
    visitedUrls: Set<string>,
    path: string[]
  ): Promise<any> {
    console.log(
      `[Multi-Repo Index] Processing ${urlsArray.length} sources at depth ${currentDepth}`
    );

    // 并发获取所有子配置
    const results = await Promise.allSettled(
      urlsArray.map(async (urlItem) => {
        const normalizedUrl = this.normalizeUrl(urlItem.url);

        // URL 去重检查
        if (visitedUrls.has(normalizedUrl)) {
          console.warn(
            `[Multi-Repo Index] Circular reference detected:\n` +
              `  URL: ${normalizedUrl}\n` +
              `  Skipping duplicate`
          );
          return null;
        }

        // 深度限制检查
        const effectiveMaxDepth = parentSource.maxDepth ?? 2;
        if (currentDepth + 1 > effectiveMaxDepth) {
          console.warn(
            `[Multi-Repo Index] Max depth ${effectiveMaxDepth} reached at depth ${currentDepth + 1}:\n` +
              `  URL: ${normalizedUrl}\n` +
              `  Skipping to respect depth limit`
          );
          return null;
        }

        console.log(
          `[Multi-Repo Index] Fetching: ${urlItem.name} (${normalizedUrl})`
        );

        // 构造虚拟 ConfigSource 对象
        const subSource = new ConfigSource(
          `${parentSource.id}_multi_${currentDepth + 1}_${urlItem.name.replace(/\s+/g, "_")}`,
          urlItem.name,
          urlItem.url,
          parentSource.priority,
          parentSource.tags,
          parentSource.status,
          parentSource.lastChecked,
          parentSource.responseTime,
          parentSource.isRecursive,
          parentSource.maxDepth,
          parentSource.enabled
        );

        try {
          // 递归调用
          return await this.fetchAndValidate(
            subSource,
            currentDepth + 1,
            visitedUrls,
            [...path, normalizedUrl]
          );
        } catch (error) {
          // 捕获错误并继续处理其他源
          console.error(
            `[Multi-Repo Index] Failed to fetch ${urlItem.name}:`,
            error.message
          );
          return null;
        }
      })
    );

    // 提取成功的子配置
    const childConfigs = results
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    if (childConfigs.length === 0) {
      console.warn(
        `[Multi-Repo Index] No valid configs fetched from ${urlsArray.length} sources`
      );
      return { sites: [], lives: [], parses: [] };
    }

    console.log(
      `[Multi-Repo Index] Successfully fetched ${childConfigs.length}/${urlsArray.length} sources`
    );

    // 合并所有子配置
    return this.mergeChildConfigs({}, childConfigs);
  }

  /**
   * 递归获取并合并子源配置
   */
  private async fetchAndMergeSubsources(
    parentConfig: any,
    parentSource: ConfigSource,
    currentDepth: number,
    visitedUrls: Set<string>,
    path: string[]
  ): Promise<any> {
    // 提取子源URL
    const subsourceUrls = this.extractSubsourceUrls(parentConfig);

    if (subsourceUrls.length === 0) {
      return parentConfig;
    }

    console.log(
      `[Recursive] Depth ${currentDepth}: Found ${subsourceUrls.length} subsources`
    );

    // 并发获取子配置
    const results = await Promise.allSettled(
      subsourceUrls.map(async (url) => {
        const normalizedUrl = this.normalizeUrl(url);

        // URL 去重检查 - 已在 fetchAndValidate 入口处检查,此处仅用于日志
        if (visitedUrls.has(normalizedUrl)) {
          console.warn(
            `[Recursive] Circular reference detected at depth ${currentDepth}:\n` +
            `  URL: ${normalizedUrl}\n` +
            `  Path: ${path.join(" -> ")} -> ${normalizedUrl}\n` +
            `  Skipping duplicate URL`
          );
          return null;
        }

        // 深度限制检查
        const effectiveMaxDepth = parentSource.maxDepth ?? 2;
        if (currentDepth + 1 > effectiveMaxDepth) {
          console.warn(
            `[Recursive] Max depth ${effectiveMaxDepth} reached at depth ${currentDepth + 1}:\n` +
            `  URL: ${normalizedUrl}\n` +
            `  Path: ${path.join(" -> ")}\n` +
            `  Skipping to respect depth limit`
          );
          return null;
        }

        // 递归调用前记录调试日志
        console.debug(
          `[Recursive] Recursing into ${normalizedUrl} at depth ${currentDepth + 1}\n` +
          `  Path: ${path.join(" -> ")} -> ${normalizedUrl}`
        );

        // 构造虚拟 ConfigSource 对象
        const subSource = new ConfigSource(
          `${parentSource.id}_sub_${currentDepth + 1}_${url.length}`,
          `Subsource of ${parentSource.name}`,
          url,
          parentSource.priority,
          parentSource.tags,
          parentSource.status,
          parentSource.lastChecked,
          parentSource.responseTime,
          parentSource.isRecursive,
          parentSource.maxDepth,
          parentSource.enabled
        );

        try {
          // 递归调用(传递更新后的路径)
          return await this.fetchAndValidate(
            subSource,
            currentDepth + 1,
            visitedUrls,
            [...path, normalizedUrl]
          );
        } catch (error) {
          // 捕获循环引用等错误并继续处理
          if (error.message.includes("Circular reference")) {
            console.warn(`[Recursive] Skipping circular reference: ${normalizedUrl}`);
          } else {
            console.error(`[Recursive] Failed to fetch ${normalizedUrl}:`, error.message);
          }
          return null;
        }
      })
    );

    // 提取成功的子配置
    const childConfigs = results
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    if (childConfigs.length === 0) {
      return parentConfig;
    }

    console.log(
      `[Recursive] Depth ${currentDepth}: Merged ${childConfigs.length} child configs`
    );

    // 合并子配置到父配置
    return this.mergeChildConfigs(parentConfig, childConfigs);
  }

  /**
   * 将子配置合并到父配置(平面合并策略)
   */
  private mergeChildConfigs(parentConfig: any, childConfigs: any[]): any {
    const merged = { ...parentConfig };

    // 合并 sites (按 key 去重,子配置优先)
    if (Array.isArray(merged.sites) || childConfigs.some((c) => Array.isArray(c.sites))) {
      const sitesMap = new Map<string, any>();

      // 先添加父级 sites
      if (Array.isArray(merged.sites)) {
        merged.sites.forEach((site: any) => {
          if (site.key) {
            sitesMap.set(site.key, site);
          }
        });
      }

      // 再添加子级 sites (会覆盖父级)
      childConfigs.forEach((config) => {
        if (Array.isArray(config.sites)) {
          config.sites.forEach((site: any) => {
            if (site.key) {
              sitesMap.set(site.key, site);
            }
          });
        }
      });

      merged.sites = Array.from(sitesMap.values());
    }

    // 合并 lives (按 name 去重,子配置优先)
    if (Array.isArray(merged.lives) || childConfigs.some((c) => Array.isArray(c.lives))) {
      const livesMap = new Map<string, any>();

      if (Array.isArray(merged.lives)) {
        merged.lives.forEach((live: any) => {
          if (live.name) {
            livesMap.set(live.name, live);
          }
        });
      }

      childConfigs.forEach((config) => {
        if (Array.isArray(config.lives)) {
          config.lives.forEach((live: any) => {
            if (live.name) {
              livesMap.set(live.name, live);
            }
          });
        }
      });

      merged.lives = Array.from(livesMap.values());
    }

    // 合并 parses (按 name 去重,子配置优先)
    if (Array.isArray(merged.parses) || childConfigs.some((c) => Array.isArray(c.parses))) {
      const parsesMap = new Map<string, any>();

      if (Array.isArray(merged.parses)) {
        merged.parses.forEach((parse: any) => {
          if (parse.name) {
            parsesMap.set(parse.name, parse);
          }
        });
      }

      childConfigs.forEach((config) => {
        if (Array.isArray(config.parses)) {
          config.parses.forEach((parse: any) => {
            if (parse.name) {
              parsesMap.set(parse.name, parse);
            }
          });
        }
      });

      merged.parses = Array.from(parsesMap.values());
    }

    // 合并 spider (扁平化数组,去重)
    const spiderSet = new Set<string>();

    const collectSpider = (spider: any) => {
      if (typeof spider === "string") {
        spiderSet.add(spider);
      } else if (Array.isArray(spider)) {
        spider.forEach((s: string) => {
          if (typeof s === "string") {
            spiderSet.add(s);
          }
        });
      }
    };

    if (merged.spider) {
      collectSpider(merged.spider);
    }

    childConfigs.forEach((config) => {
      if (config.spider) {
        collectSpider(config.spider);
      }
    });

    if (spiderSet.size > 0) {
      merged.spider = Array.from(spiderSet);
    }

    // wallpaper 直接覆盖(子配置优先)
    for (const config of childConfigs) {
      if (config.wallpaper) {
        merged.wallpaper = config.wallpaper;
        break;
      }
    }

    return merged;
  }
}
