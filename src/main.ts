/**
 * TVBox 配置聚合服务 - Deno Deploy 入口文件
 *
 * 主推平台：Deno Deploy
 * 备选平台：Cloudflare Workers, Vercel Edge
 */

import { Application, Router } from "oak";
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

// 服务容器
let services: {
  cacheService: CacheManagerService;
  aggregateUseCase: AggregateConfigUseCase;
  healthCheckUseCase: HealthCheckUseCase;
} | null = null;

// 路由容器
let routers: {
  configRouter: Router;
  healthRouter: Router;
  statsRouter: Router;
} | null = null;

// 初始化服务（只执行一次）
async function getServices() {
  if (!services) {
    const adapter = new DenoRuntimeAdapter(Deno.env.toObject());
    const cacheService = new CacheManagerService(await adapter.getKV());
    const aggregateUseCase = new AggregateConfigUseCase(cacheService);
    const healthCheckUseCase = new HealthCheckUseCase();

    services = { cacheService, aggregateUseCase, healthCheckUseCase };
    console.log("[Init] Services initialized");
  }
  return services;
}

// 获取路由（懒加载）
async function getRouters() {
  if (!routers) {
    const { aggregateUseCase, healthCheckUseCase, cacheService } = await getServices();

    const configRouter = createConfigRoute(aggregateUseCase);
    const healthRouter = createHealthRoute(healthCheckUseCase);
    const statsRouter = createStatsRoute(cacheService);

    routers = { configRouter, healthRouter, statsRouter };
    console.log("[Init] Routers initialized");
  }
  return routers;
}

// 创建应用
const app = new Application();

// 中间件
app.use(corsMiddleware);
app.use(errorHandlerMiddleware);
app.use(cacheMiddleware);

// API 路由（使用延迟初始化）
app.use(async (ctx, next) => {
  const { configRouter, healthRouter, statsRouter } = await getRouters();

  // 尝试每个路由
  await configRouter.routes()(ctx, async () => {
    await healthRouter.routes()(ctx, async () => {
      await statsRouter.routes()(ctx, next);
    });
  });
});

// 处理 OPTIONS 方法
app.use(async (ctx, next) => {
  const { configRouter, healthRouter, statsRouter } = await getRouters();

  await configRouter.allowedMethods()(ctx, async () => {
    await healthRouter.allowedMethods()(ctx, async () => {
      await statsRouter.allowedMethods()(ctx, next);
    });
  });
});

// 管理路由（无依赖，直接创建）
const adminRouter = createAdminRoute();
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

// Deno Deploy 导出
export default app;

// 启动服务器（仅在本地开发环境）
const isLocalDev = !Deno.env.get("DENO_DEPLOYMENT_ID");

if (isLocalDev) {
  await getServices(); // 预先初始化服务
  await getRouters();  // 预先初始化路由

  try {
    const port = parseInt(Deno.env.get("PORT") || "8000");
    console.log(`🚀 Development server running on http://localhost:${port}`);
    await app.listen({ port });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
} else {
  console.log("Running on Deno Deploy");
}
