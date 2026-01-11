/**
 * 配置路由
 */
import { Router } from "oak";
import { AggregateConfigUseCase, AggregateOptions } from "../../application/use-cases/aggregate-config.use-case.ts";

export function createConfigRoute(useCase: AggregateConfigUseCase): Router {
  const router = new Router();

  router.prefix("/api");

  // GET /api/config - 获取聚合配置
  router.get("/config", async (ctx) => {
    try {
      // 解析查询参数
      const options: AggregateOptions = {
        includeTags: ctx.request.url.searchParams.get("tags")
          ? ctx.request.url.searchParams.get("tags")!.split(",")
          : undefined,
        minPriority: ctx.request.url.searchParams.get("minPriority")
          ? Number(ctx.request.url.searchParams.get("minPriority"))
          : undefined,
        excludeFailed: ctx.request.url.searchParams.get("excludeFailed") !==
          "false",
        maxSources: ctx.request.url.searchParams.get("maxSources")
          ? Number(ctx.request.url.searchParams.get("maxSources"))
          : undefined,
      };

      // 执行聚合
      const result = await useCase.execute(options);

      // 设置响应头
      ctx.response.status = 200;
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.headers.set("Cache-Control", "public, max-age=900");
      ctx.response.headers.set(
        "X-Response-Time",
        `${Date.now() - result.generatedAt.getTime()}ms`
      );
      ctx.response.body = result;
    } catch (error) {
      console.error("[Config Route] Error:", error);
      ctx.response.status = 500;
      ctx.response.body = {
        error: "Internal Server Error",
        message: error.message,
      };
    }
  });

  return router;
}
