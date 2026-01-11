/**
 * 健康检查路由
 */
import { Router } from "oak";
import { HealthCheckUseCase } from "../../../application/use-cases/health-check.use-case.ts";

export function createHealthRoute(useCase: HealthCheckUseCase): Router {
  const router = new Router();

  router.prefix("/api");

  // GET /api/health - 获取健康状态
  router.get("/health", async (ctx) => {
    try {
      const report = await useCase.checkAllSources();

      ctx.response.status = 200;
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.headers.set("Cache-Control", "public, max-age=300");
      ctx.response.body = report;
    } catch (error) {
      console.error("[Health Route] Error:", error);
      ctx.response.status = 500;
      ctx.response.body = {
        error: "Internal Server Error",
        message: error.message,
      };
    }
  });

  // POST /api/health/check - 触发健康检查
  router.post("/health/check", async (ctx) => {
    try {
      // 异步执行健康检查
      const taskId = `check-${Date.now()}`;
      console.log(`[HealthCheck] Task ${taskId} started`);

      // 不等待完成，立即返回
      ctx.response.status = 202;
      ctx.response.body = {
        taskId,
        status: "pending",
        message: "Health check initiated",
      };

      // 后台执行（实际应用中应该使用队列）
      useCase.checkAllSources().catch((error) => {
        console.error(`[HealthCheck] Task ${taskId} failed:`, error);
      });
    } catch (error) {
      console.error("[HealthCheck Route] Error:", error);
      ctx.response.status = 500;
      ctx.response.body = {
        error: "Internal Server Error",
        message: error.message,
      };
    }
  });

  return router;
}
