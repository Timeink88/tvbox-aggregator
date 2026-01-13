# IMPL-003 任务总结

## 任务目标
调查并修复 Health/Stats 数据不一致问题

## 问题分析

### 根本原因
1. **Admin Stats API** (`/admin/api/stats`) 使用 `Math.random()` 生成硬编码模拟数据
2. **Admin Sources API** (`/admin/api/sources`) 使用 `Math.random()` 生成随机状态
3. **Health API** (`/api/health`) 执行实时健康检查，返回真实结果

### 数据不一致表现
- **Health API**: `{"total": 7, "healthy": 0, "degraded": 0, "failed": 7}`
- **Admin Stats API**: `{"total": 7, "healthy": 6, "degraded": 1, "failed": 0}` (硬编码)
- **时间戳**: Admin API 比 Health API 早 2 秒（旧数据）

## 修复方案

### 文件修改
`src/presentation/api/admin.route.ts`

#### 修改 1: 导入 HealthCheckUseCase
```typescript
// 第 5 行
import { HealthCheckUseCase } from "../../application/use-cases/health-check.use-case.ts";
```

#### 修改 2: 重写 /admin/api/stats 端点
```typescript
// 第 22-55 行
router.get("/api/stats", async (ctx) => {
  try {
    const healthReport = await healthCheckUseCase.checkAllSources();

    ctx.response.body = {
      totalRequests: 0, // TODO
      todayRequests: 0, // TODO
      avgResponseTime: healthReport.sources.length > 0
        ? Math.round(healthReport.sources.reduce((sum, s) => sum + s.responseTime, 0) / healthReport.sources.length)
        : 0,
      uptime: "N/A", // TODO
      sources: {
        total: healthReport.total,
        healthy: healthReport.healthy,
        degraded: healthReport.degraded,
        failed: healthReport.failed,
      },
      cache: { hitRate: 0, size: "N/A", entries: 0 }, // TODO
      lastUpdated: healthReport.lastChecked.toISOString(),
    };
  } catch (error) {
    // 错误处理
  }
});
```

#### 修改 3: 重写 /admin/api/sources 端点
```typescript
// 第 58-91 行
router.get("/api/sources", async (ctx) => {
  try {
    const healthReport = await healthCheckUseCase.checkAllSources();
    const content = await Deno.readTextFile(
      new URL("../../../config/sources.json", import.meta.url)
    );
    const sourcesConfig = JSON.parse(content);

    // 合并配置和健康状态
    const sourceMap = new Map(healthReport.sources.map(s => [s.sourceId, s]));
    const sourcesWithStatus = sourcesConfig.map((config: any) => {
      const health = sourceMap.get(config.id);
      return {
        ...config,
        status: health?.status || "unknown",
        responseTime: health?.responseTime || 0,
        lastChecked: health?.lastChecked || new Date(),
      };
    });

    ctx.response.body = { success: true, data: sourcesWithStatus };
  } catch (error) {
    // 错误处理
  }
});
```

## 验证结果

### Health API (`/api/health`)
```json
{
  "total": 7,
  "healthy": 0,
  "degraded": 0,
  "failed": 7,
  "lastChecked": "2026-01-13T02:01:56.905Z"
}
```

### Admin Stats API (`/admin/api/stats`)
```json
{
  "totalRequests": 0,
  "todayRequests": 0,
  "avgResponseTime": 528,
  "uptime": "N/A",
  "sources": {
    "total": 7,
    "healthy": 0,
    "degraded": 0,
    "failed": 7
  },
  "cache": {
    "hitRate": 0,
    "size": "N/A",
    "entries": 0
  },
  "lastUpdated": "2026-01-13T02:01:54.894Z"
}
```

### Admin Sources API (`/admin/api/sources`)
```json
{
  "success": true,
  "data": [
    {
      "id": "fantaiying",
      "name": "饭太硬",
      "url": "http://www.xn--sss604efuw.com/tv/",
      "status": "failed",
      "responseTime": 133,
      "lastChecked": "2026-01-13T02:02:58.010Z"
    },
    // ... 其他 6 个源
  ]
}
```

### 数据一致性确认
- ✅ `total: 7` (3 个 API 一致)
- ✅ `healthy: 0` (3 个 API 一致)
- ✅ `degraded: 0` (3 个 API 一致)
- ✅ `failed: 7` (3 个 API 一致)
- ✅ `avgResponseTime: 528ms` (真实平均值)
- ✅ 每个源的 `status`、`responseTime`、`lastChecked` 都来自真实健康检查

## 技术细节

### 导入路径问题修复
- **错误**: `import { HealthCheckUseCase } from "./v1/health.route.ts"`
- **正确**: `import { HealthCheckUseCase } from "../../application/use-cases/health-check.use-case.ts"`

### 相对路径计算
- `src/presentation/api/admin.route.ts`
- 向上 3 级: `../../../config/sources.json`

## 后续工作
虽然数据不一致问题已解决，但当前所有 7 个源都显示 `failed` 状态，这需要在 **IMPL-004** 中优化 Health Check 验证逻辑。
