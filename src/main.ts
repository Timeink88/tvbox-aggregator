/**
 * TVBox 配置聚合服务 - Deno Deploy 入口文件
 *
 * 主推平台：Deno Deploy
 * 备选平台：Cloudflare Workers, Vercel Edge
 */

import { Application } from "oak";
import { createConfigRoute } from "./presentation/api/v1/config.route.ts";
import { createHealthRoute } from "./presentation/api/v1/health.route.ts";
import { createStatsRoute } from "./presentation/api/v1/stats.route.ts";
import { createAdminRoute } from "./presentation/api/admin.route.ts";
import { DenoRuntimeAdapter } from "./infrastructure/adapters/runtime/deno.runtime.adapter.ts";
import { AggregateConfigUseCase } from "./application/use-cases/aggregate-config.use-case.ts";
import { CacheManagerService } from "./application/services/cache-manager.service.ts";
import { HealthCheckUseCase } from "./application/use-cases/health-check.use-case.ts";
import { corsMiddleware } from "./presentation/api/middleware/cors.middleware.ts";
import { errorHandlerMiddleware } from "./presentation/api/middleware/error-handler.middleware.ts";
import { cacheMiddleware } from "./presentation/api/middleware/cache.middleware.ts";

// 创建平台适配器
const adapter = new DenoRuntimeAdapter(Deno.env.toObject());

// 创建应用服务
const cacheService = new CacheManagerService(await adapter.getKV());
const aggregateUseCase = new AggregateConfigUseCase(cacheService);
const healthCheckUseCase = new HealthCheckUseCase();

// 创建路由
const configRouter = createConfigRoute(aggregateUseCase);
const healthRouter = createHealthRoute(healthCheckUseCase);
const statsRouter = createStatsRoute(cacheService);
const adminRouter = createAdminRoute();

// 创建应用
const app = new Application();

// 中间件
app.use(corsMiddleware);
app.use(errorHandlerMiddleware);
app.use(cacheMiddleware);

// 路由
app.use(configRouter.routes());
app.use(configRouter.allowedMethods());
app.use(healthRouter.routes());
app.use(healthRouter.allowedMethods());
app.use(statsRouter.routes());
app.use(statsRouter.allowedMethods());
app.use(adminRouter.routes());
app.use(adminRouter.allowedMethods());

// 根路径健康检查
app.use(async (ctx) => {
  ctx.response.body = {
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      config: "/api/config",
      health: "/api/health",
      stats: "/api/stats",
      admin: "/admin",
    },
  };
});

// 启动服务器（仅在本地开发环境）
if (import.meta.main) {
  const port = parseInt(Deno.env.get("PORT") || "8000");
  console.log(`🚀 Server running on http://localhost:${port}`);
  await app.listen({ port });
}

// Deno Deploy 导出
export default app;
