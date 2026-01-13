/**
 * 错误处理中间件
 */
export const errorHandlerMiddleware = async (ctx: any, next: any) => {
  try {
    await next();
  } catch (error: any) {
    console.error("[ErrorHandler]", error);

    ctx.response.status = error.status || 500;
    ctx.response.body = {
      error: error.message || "Internal Server Error",
      timestamp: new Date().toISOString(),
    };

    // 确保设置了Content-Type
    if (!ctx.response.headers.get("Content-Type")) {
      ctx.response.headers.set("Content-Type", "application/json");
    }
  }
};
