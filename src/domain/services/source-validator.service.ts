/**
 * 源验证服务
 */
import { ConfigSource, SourceStatus } from "../entities/config-source.entity.ts";

export class SourceValidatorService {
  private readonly USER_AGENT = "TVBox-Fetcher/2.0";
  private readonly DEFAULT_TIMEOUT = 10000;
  private readonly MAX_RETRIES = 3;

  /**
   * 获取并验证源配置
   */
  async fetchAndValidate(source: ConfigSource): Promise<any> {
    const startTime = Date.now();

    try {
      // 四阶段验证
      const result = await this.validateWithStages(source);

      const responseTime = Date.now() - startTime;

      // 更新源状态
      source.updateStatus(result.status, responseTime);

      if (result.status === SourceStatus.HEALTHY && result.config) {
        return result.config;
      }

      throw new Error(`Source validation failed: ${result.status}`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      source.updateStatus(
        error.name === "AbortError" ? SourceStatus.TIMEOUT : SourceStatus.FAILED,
        responseTime
      );
      throw error;
    }
  }

  /**
   * 四阶段验证流程
   */
  private async validateWithStages(source: ConfigSource): Promise<{
    status: SourceStatus;
    config?: any;
  }> {
    // 阶段1: 快速预检 (HEAD请求)
    const headResult = await this.headRequest(source.url);
    if (!headResult.ok) {
      return { status: SourceStatus.FAILED };
    }

    // 阶段2: 内容类型验证
    const contentType = headResult.headers.get("content-type") || "";
    if (!this.isValidContentType(contentType)) {
      return { status: SourceStatus.DEGRADED };
    }

    // 阶段3: 部分内容验证
    const partialResult = await this.partialContentRequest(source.url);
    if (!partialResult.valid) {
      return { status: SourceStatus.DEGRADED };
    }

    // 阶段4: 完整获取
    const config = await this.fullContentRequest(source.url);
    if (config && this.isValidTVBoxConfig(config)) {
      return { status: SourceStatus.HEALTHY, config };
    }

    return { status: SourceStatus.DEGRADED };
  }

  /**
   * HEAD请求（快速预检）
   */
  private async headRequest(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    try {
      const response = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": this.USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 部分内容请求（验证JSON格式）
   */
  private async partialContentRequest(url: string): Promise<{
    valid: boolean;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.USER_AGENT,
          "Range": "bytes=0-1024", // 只获取前1KB
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return { valid: false };
      }

      const text = await response.text();

      // 验证JSON格式
      try {
        // 清理JSON（去除注释、BOM等）
        const clean = this.cleanJsonText(text);
        JSON.parse(clean);
        return { valid: true };
      } catch {
        return { valid: false };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      return { valid: false };
    }
  }

  /**
   * 完整内容请求
   */
  private async fullContentRequest(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.DEFAULT_TIMEOUT
    );

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

      // 清理并解析JSON
      const clean = this.cleanJsonText(text);
      return JSON.parse(clean);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 验证内容类型
   */
  private isValidContentType(contentType: string): boolean {
    return (
      contentType.includes("application/json") ||
      contentType.includes("text/json") ||
      contentType.includes("text/plain")
    );
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
}
