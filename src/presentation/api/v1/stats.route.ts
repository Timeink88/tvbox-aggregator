/**
 * 统计路由
 */
import { Router } from "oak";
import { CacheManagerService, CacheStats } from "../../../application/services/cache-manager.service.ts";
import { HealthCheckUseCase } from "../../../application/use-cases/health-check.use-case.ts";

export function createStatsRoute(
  cacheService: CacheManagerService,
  healthCheckUseCase: HealthCheckUseCase
): Router {
  const router = new Router();

  // GET /api/stats - 获取系统统计
  router.get("/api/stats", async (ctx) => {
    try {
      const cacheStats = cacheService.getStats();

      // 获取健康检查数据
      const healthReport = await healthCheckUseCase.checkAllSources();

      ctx.response.status = 200;
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.headers.set("Cache-Control", "public, max-age=300");
      ctx.response.body = {
        uptime: "N/A",
        memory: {
          used: `${(Deno.memoryUsage?.().heapUsed / 1024 / 1024).toFixed(2) || 0} MB`,
          total: `${(Deno.memoryUsage?.().heapTotal / 1024 / 1024).toFixed(2) || 0} MB`,
        },
        cache: cacheStats,
        sources: {
          total: healthReport.total,
          healthy: healthReport.healthy,
          degraded: healthReport.degraded,
          failed: healthReport.failed,
          lastChecked: healthReport.lastChecked,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("[Stats Route] Error:", error);
      ctx.response.status = 500;
      ctx.response.body = {
        error: "Internal Server Error",
        message: error?.message || "Unknown error",
      };
    }
  });

  return router;
}
