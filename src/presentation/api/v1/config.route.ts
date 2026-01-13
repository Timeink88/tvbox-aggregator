/**
 * 配置路由
 */
import { Router } from "oak";
import { AggregateConfigUseCase, AggregateOptions } from "../../../application/use-cases/aggregate-config.use-case.ts";

export function createConfigRoute(useCase: AggregateConfigUseCase): Router {
  const router = new Router();

  // GET /api/config - 获取聚合配置
  router.get("/api/config", async (ctx) => {
    try {
      // 解析查询参数
      const options: AggregateOptions = {
        includeTags: ctx.request.url.searchParams.get("tags")
          ? ctx.request.url.searchParams.get("tags")!.split(",")
          : undefined,
        minPriority: ctx.request.url.searchParams.get("minPriority")
          ? Number(ctx.request.url.searchParams.get("minPriority"))
          : undefined,
        excludeFailed: ctx.request.url.searchParams.get("excludeFailed") ===
          "true" ? true : ctx.request.url.searchParams.get("excludeFailed") === "false" ? false : undefined,
        maxSources: ctx.request.url.searchParams.get("maxSources")
          ? Number(ctx.request.url.searchParams.get("maxSources"))
          : undefined,
        includeContent: ctx.request.url.searchParams.get("includeContent") === "true",
      };

      // 执行聚合（可能失败，如果失败则直接返回源列表）
      let result;
      try {
        result = await useCase.execute(options);
      } catch (fetchError) {
        console.warn("[Config] Fetch from remote failed, returning local sources:", fetchError.message);

        // 如果远程获取失败，直接读取并返回本地源配置
        const content = await Deno.readTextFile(
          new URL("../../../config/sources.json", import.meta.url)
        );
        const sourcesData = JSON.parse(content);

        // 过滤源
        let filteredSources = sourcesData.filter((s: any) => s.enabled);

        if (options.excludeFailed !== false) {
          // 简单过滤：只返回启用的源
          filteredSources = filteredSources.filter((s: any) => s.enabled);
        }

        if (options.minPriority !== undefined) {
          filteredSources = filteredSources.filter((s: any) => s.priority >= options.minPriority!);
        }

        if (options.includeTags?.length) {
          filteredSources = filteredSources.filter((s: any) =>
            options.includeTags!.some((tag: string) => s.tags.includes(tag))
          );
        }

        if (options.maxSources) {
          filteredSources = filteredSources
            .sort((a: any, b: any) => b.priority - a.priority)
            .slice(0, options.maxSources);
        }

        result = {
          version: new Date().toISOString().split("T")[0],
          sources: filteredSources.map((s: any) => ({
            name: s.name,
            url: s.url,
            icon: s.icon,
            priority: s.priority,
            status: s.enabled ? "available" : "disabled",
          })),
          total: filteredSources.length,
          healthySources: filteredSources.length,
          generatedAt: new Date(),
          cacheTTL: 900,
          note: "远程获取失败，返回本地源列表",
        };
      }

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
