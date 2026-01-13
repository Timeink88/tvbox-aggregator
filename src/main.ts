/**
 * TVBox 配置聚合服务 - Deno Deploy 入口文件
 *
 * 主推平台：Deno Deploy
 * 备选平台：Cloudflare Workers, Vercel Edge
 *
 * @module main
 * @description TVBox 配置源聚合服务的入口文件,负责初始化 Oak 应用、
 *              注册路由和中间件,并提供 Deno Deploy 兼容的 fetch handler。
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

/**
 * 服务容器 - 单例模式
 * @description 缓存已初始化的服务实例,避免重复创建
 */
let services: {
  cacheService: CacheManagerService;
  aggregateUseCase: AggregateConfigUseCase;
  healthCheckUseCase: HealthCheckUseCase;
} | null = null;

/**
 * 路由容器 - 单例模式
 * @description 缓存已初始化的路由实例,避免重复创建
 */
let routers: {
  configRouter: Router;
  healthRouter: Router;
  statsRouter: Router;
} | null = null;

/**
 * 初始化服务（只执行一次）
 * @description 创建并缓存服务实例,包括 KV 存储、配置聚合和健康检查服务
 * @returns {Promise<{cacheService: CacheManagerService, aggregateUseCase: AggregateConfigUseCase, healthCheckUseCase: HealthCheckUseCase}>} 服务实例对象
 */
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

/**
 * 获取路由（懒加载）
 * @description 创建并缓存路由实例,依赖服务实例
 * @returns {Promise<{configRouter: Router, healthRouter: Router, statsRouter: Router}>} 路由实例对象
 */
async function getRouters() {
  if (!routers) {
    const { aggregateUseCase, healthCheckUseCase, cacheService } =
      await getServices();

    const configRouter = createConfigRoute(aggregateUseCase);
    const healthRouter = createHealthRoute(healthCheckUseCase);
    const statsRouter = createStatsRoute(cacheService, healthCheckUseCase);

    routers = { configRouter, healthRouter, statsRouter };
    console.log("[Init] Routers initialized");
  }
  return routers;
}

/**
 * 初始化路由（在模块加载时）
 * @description 在应用启动时预先初始化所有路由,确保服务已准备好
 */
const { configRouter, healthRouter, statsRouter } = await getRouters();

/**
 * 创建 Oak 应用实例
 * @description Oak 是 Deno 的 Web 框架,提供中间件系统和路由功能
 */
const app = new Application();

/**
 * ========================================
 * 中间件注册
 * ========================================
 * 中间件按注册顺序执行,顺序很重要:
 * 1. CORS - 处理跨域请求
 * 2. Error Handler - 捕获全局错误
 * 3. Cache - 缓存响应
 */

// CORS 中间件 - 处理跨域资源共享
app.use(corsMiddleware);

// 错误处理中间件 - 捕获并处理应用中的错误
app.use(errorHandlerMiddleware);

// 缓存中间件 - 缓存响应以提高性能
app.use(cacheMiddleware);

/**
 * ========================================
 * 根路径处理器
 * ========================================
 * 优先级最高,匹配所有对根路径 "/" 的请求
 * 返回 API 端点列表和基本信息
 */
app.use(async (ctx, next) => {
  if (ctx.request.url.pathname === "/") {
    ctx.response.status = 200;
    ctx.response.headers.set("Content-Type", "application/json");
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
    console.log("[Health] Root path checked");
    return; // 不继续传递
  }
  await next(); // 其他路径继续传递
});

/**
 * ========================================
 * 路由注册 - 标准 Oak 模式
 * ========================================
 *
 * Oak 标准路由注册模式:
 * 1. 使用 router.routes() 注册路由中间件
 * 2. 使用 router.allowedMethods() 处理 HTTP 方法 OPTIONS
 * 3. 路由文件中定义的路径前缀 (router.prefix) 会自动生效
 *
 * 为什么使用 app.use() 而不是手动中间件链?
 * - Oak 的 router.routes() 返回标准中间件函数
 * - app.use() 会自动处理路由匹配和中间件链
 * - 手动调用 router.routes()(ctx, callback) 不是 Oak 的设计意图
 * - 标准模式更简洁、可维护,且符合 Oak 最佳实践
 *
 * 参考: Admin 路由的正确实现 (工作正常)
 */

// 管理路由（无依赖，直接创建）
const adminRouter = createAdminRoute();

// 挂载 Admin 路由到应用 - 标准模式
app.use(adminRouter.routes());
app.use(adminRouter.allowedMethods());

/**
 * API 路由挂载
 * @description 使用标准 Oak 模式挂载所有 API 路由
 *
 * 路由前缀说明:
 * - configRouter: 在路由文件中已定义 prefix('/api'),路径如 /api/config
 * - healthRouter: 在路由文件中已定义 prefix('/api'),路径如 /api/health
 * - statsRouter: 在路由文件中已定义 prefix('/api'),路径如 /api/stats
 *
 * 标准模式优势:
 * 1. 自动处理路由匹配
 * 2. 支持 HTTP 方法 OPTIONS
 * 3. 与 Oak 中间件链完美集成
 * 4. 易于维护和扩展
 */

// 配置聚合 API - 获取 TVBox 配置源
app.use(configRouter.routes());
app.use(configRouter.allowedMethods());

// 健康检查 API - 检查服务状态
app.use(healthRouter.routes());
app.use(healthRouter.allowedMethods());

// 统计信息 API - 获取缓存统计
app.use(statsRouter.routes());
app.use(statsRouter.allowedMethods());

/**
 * ========================================
 * Deno Deploy 导出
 * ========================================
 * Deno Deploy 要求导出包含 fetch 函数的对象
 * fetch 函数接收标准的 Web Request 对象,返回 Response 对象
 *
 * 工作流程:
 * 1. 接收 Deno Deploy 的 Request 对象
 * 2. 转换为 Oak 兼容的请求格式
 * 3. 使用 Oak Application.handle() 处理请求
 * 4. 将 Oak Response 转换为标准 Response 对象
 */
export default {
  /**
   * Deno Deploy fetch handler
   * @param {Request} request - 标准 Web Request 对象
   * @returns {Promise<Response>} 标准 Response 对象
   * @description 处理所有传入的 HTTP 请求,委托给 Oak 应用
   */
  async fetch(request: Request): Promise<Response> {
    // 将 Request 转换为 Oak 能处理的格式
    const url = new URL(request.url);

    // 创建一个兼容的请求对象
    const oakRequest = {
      url,
      method: request.method,
      headers: request.headers,
      body: request.body,
      request,
    };

    // 使用 Oak Application 处理请求
    const response = await app.handle(oakRequest as any);

    // 转换响应为标准的 Response
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  },
};

/**
 * ========================================
 * 本地开发服务器
 * ========================================
 * 仅在非 Deno Deploy 环境下启动本地服务器
 * Deno Deploy 环境检测: 存在 DENO_DEPLOYMENT_ID 环境变量
 */
const isLocalDev = !Deno.env.get("DENO_DEPLOYMENT_ID");

if (isLocalDev) {
  await getServices(); // 预先初始化服务
  await getRouters(); // 预先初始化路由

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
