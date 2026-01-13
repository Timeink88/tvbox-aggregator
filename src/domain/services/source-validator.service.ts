/**
 * 源验证服务
 */
import { ConfigSource, SourceStatus } from "../entities/config-source.entity.ts";

export class SourceValidatorService {
  private readonly USER_AGENT = "TVBox-Fetcher/2.0";
  private readonly QUICK_TIMEOUT = 5000; // 快速验证超时 5秒
  private readonly FULL_TIMEOUT = 15000; // 完整验证超时 15秒

  /**
   * 获取并验证源配置（优化版：更宽松的验证）
   */
  async fetchAndValidate(source: ConfigSource): Promise<any> {
    const startTime = Date.now();

    try {
      // 两阶段验证（简化版）
      const result = await this.validateWithOptimizedStages(source);

      const responseTime = Date.now() - startTime;
      source.updateStatus(result.status, responseTime);

      console.log(
        `[SourceValidator] ${source.name}: ${result.status} (${responseTime}ms)`
      );

      if (result.status === SourceStatus.HEALTHY && result.config) {
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
   * 优化的两阶段验证流程
   */
  private async validateWithOptimizedStages(source: ConfigSource): Promise<{
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
      const config = await this.fullContentRequest(source.url);
      if (config && this.isValidTVBoxConfig(config)) {
        return { status: SourceStatus.HEALTHY, config };
      } else {
        return { status: SourceStatus.DEGRADED };
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
   * 完整内容请求
   */
  private async fullContentRequest(url: string): Promise<any> {
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

      // 清理并解析JSON
      const clean = this.cleanJsonText(text);
      return JSON.parse(clean);
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
}
