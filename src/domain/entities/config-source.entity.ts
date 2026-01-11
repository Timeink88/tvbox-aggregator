/**
 * 配置源实体
 */
export class ConfigSource {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly url: string,
    public priority: number = 50,
    public tags: string[] = [],
    public status: SourceStatus = SourceStatus.UNKNOWN,
    public lastChecked: Date | null = null,
    public responseTime: number = 0,
    public isRecursive: boolean = false,
    public maxDepth: number = 1,
    public enabled: boolean = true
  ) {}

  /**
   * 更新源状态
   */
  updateStatus(status: SourceStatus, responseTime: number): void {
    this.status = status;
    this.responseTime = responseTime;
    this.lastChecked = new Date();
  }

  /**
   * 计算健康评分 (0-1)
   */
  calculateHealthScore(): number {
    const statusScore = this.getStatusScore();
    const responseScore = this.getResponseScore();
    const priorityScore = this.priority / 100;

    return (statusScore * 0.5) + (responseScore * 0.3) + (priorityScore * 0.2);
  }

  private getStatusScore(): number {
    switch (this.status) {
      case SourceStatus.HEALTHY:
        return 1.0;
      case SourceStatus.DEGRADED:
        return 0.5;
      case SourceStatus.FAILED:
        return 0.0;
      case SourceStatus.TIMEOUT:
        return 0.1;
      default:
        return 0.3;
    }
  }

  private getResponseScore(): number {
    // 100ms = 1.0, 10s = 0.0
    return Math.max(0, 1 - (this.responseTime - 100) / 9900);
  }

  /**
   * 是否可用
   */
  isAvailable(): boolean {
    return this.enabled && this.status !== SourceStatus.FAILED;
  }
}

/**
 * 源状态枚举
 */
export enum SourceStatus {
  UNKNOWN = "unknown",
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  FAILED = "failed",
  TIMEOUT = "timeout",
}
