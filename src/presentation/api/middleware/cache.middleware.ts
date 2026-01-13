/**
 * 缓存中间件（用于响应头设置）
 */
export const cacheMiddleware = async (ctx: any, next: any) => {
  await next();

  // 如果请求成功，添加缓存相关头部
  if (ctx.response.status === 200) {
    // 默认缓存15分钟
    if (!ctx.response.headers.get("Cache-Control")) {
      ctx.response.headers.set("Cache-Control", "public, max-age=900");
    }

    // 添加ETag（基于响应内容）
    const body = ctx.response.body;
    if (body && typeof body === "object") {
      const etag = generateETag(body);
      ctx.response.headers.set("ETag", `"${etag}"`);
    }
  }
};

function generateETag(obj: any): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
