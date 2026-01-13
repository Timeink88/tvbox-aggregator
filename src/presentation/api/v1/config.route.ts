/**
 * 配置路由
 */
import { Router } from "oak";
import { AggregateConfigUseCase, AggregateOptions } from "../../../application/use-cases/aggregate-config.use-case.ts";

export function createConfigRoute(useCase: AggregateConfigUseCase): Router {
  const router = new Router();

  // GET /api/config - 获取聚合配置（包含状态信息）
  router.get("/api/config", async (ctx) => {
    try {
      // 解析查询参数
      const includeContentParam = ctx.request.url.searchParams.get("includeContent");
      const enableRecursiveParam = ctx.request.url.searchParams.get("enableRecursive");
      const maxDepthOverrideParam = ctx.request.url.searchParams.get("maxDepthOverride");

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
        includeContent: includeContentParam ? includeContentParam === "true" : undefined,
        /**
         * 递归解析控制参数
         * 默认值为 true,符合用户"真正解析"的意图
         * 仅当显式传递 "false" 时禁用递归
         */
        enableRecursive: enableRecursiveParam !== "false",
        /**
         * 深度覆盖参数
         * 如果指定且有效,将覆盖源配置中的 maxDepth
         */
        maxDepthOverride: maxDepthOverrideParam ? parseInt(maxDepthOverrideParam, 10) || undefined : undefined,
      };

      // 执行聚合
      const options: AggregateOptions = {
        includeTags: ctx.request.url.searchParams.get("tags")
          ? ctx.request.url.searchParams.get("tags")!.split(",")
          : undefined,
        minPriority: ctx.request.url.searchParams.get("minPriority")
          ? Number(ctx.request.url.searchParams.get("minPriority"))
          : undefined,
        excludeFailed: true,
        includeContent: true,
        enableRecursive: enableRecursiveParam !== "false",
        maxDepthOverride: maxDepthOverrideParam ? parseInt(maxDepthOverrideParam, 10) || undefined : undefined,
      };

      const result = await useCase.execute(options);

      // 返回纯TVBox JSON格式（TVBox软件可直接使用）
      if (result.merged_config) {
        ctx.response.status = 200;
        ctx.response.headers.set("Content-Type", "application/json; charset=utf-8");
        ctx.response.headers.set("Cache-Control", "public, max-age=3600");
        ctx.response.body = result.merged_config;
      } else {
        ctx.response.status = 200;
        ctx.response.headers.set("Content-Type", "application/json; charset=utf-8");
        ctx.response.body = {
          sites: [],
          lives: [],
          parses: [],
          spider: "",
          wallpaper: ""
        };
      }
    } catch (error) {
      console.error("[Config Route] Error:", error);
      ctx.response.status = 500;
      ctx.response.body = {
        error: "Internal Server Error",
        message: error.message,
      };
    }
  });

  // GET /api/tvbox.json - TVBox软件专用接口（返回纯TVBox JSON格式）
  router.get("/api/tvbox.json", async (ctx) => {
    try {
      const enableRecursiveParam = ctx.request.url.searchParams.get("enableRecursive");
      const maxDepthOverrideParam = ctx.request.url.searchParams.get("maxDepthOverride");

      const options: AggregateOptions = {
        includeTags: ctx.request.url.searchParams.get("tags")
          ? ctx.request.url.searchParams.get("tags")!.split(",")
          : undefined,
        minPriority: ctx.request.url.searchParams.get("minPriority")
          ? Number(ctx.request.url.searchParams.get("minPriority"))
          : undefined,
        excludeFailed: true,
        includeContent: true,
        enableRecursive: enableRecursiveParam !== "false",
        maxDepthOverride: maxDepthOverrideParam ? parseInt(maxDepthOverrideParam, 10) || undefined : undefined,
      };

      // 执行聚合
      const result = await useCase.execute(options);

      // 返回纯TVBox JSON格式（无包装）
      if (result.merged_config) {
        ctx.response.status = 200;
        ctx.response.headers.set("Content-Type", "application/json; charset=utf-8");
        ctx.response.headers.set("Cache-Control", "public, max-age=3600");
        ctx.response.headers.set(
          "X-Config-Version",
          result.version
        );
        ctx.response.headers.set(
          "X-Sources-Count",
          String(result.total)
        );
        ctx.response.body = result.merged_config;
      } else {
        // 如果没有合并配置，返回空配置
        ctx.response.status = 200;
        ctx.response.headers.set("Content-Type", "application/json; charset=utf-8");
        ctx.response.body = {
          sites: [],
          lives: [],
          parses: [],
          spider: "",
          wallpaper: ""
        };
      }
    } catch (error) {
      console.error("[TVBox Config Route] Error:", error);
      // 错误时返回空配置而不是错误对象，确保TVBox软件能正常处理
      ctx.response.status = 200;
      ctx.response.headers.set("Content-Type", "application/json; charset=utf-8");
      ctx.response.body = {
        sites: [],
        lives: [],
        parses: [],
        spider: "",
        wallpaper: ""
      };
    }
  });

  return router;
}
