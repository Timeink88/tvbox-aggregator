# Task: IMPL-001 修复 Admin 路由 404 错误

## Implementation Summary

### Files Modified
- `src/presentation/api/admin.route.ts`: 添加 `router.prefix("/admin")` 设置路由前缀

### Content Added
- **router.prefix("/admin")** (`src/presentation/api/admin.route.ts:11`): 为 Admin 路由器设置 `/admin` 路径前缀，使所有路由自动继承此前缀
  - 影响: 所有 Admin 路由路径从 `/` 变为 `/admin`，从 `/api/stats` 变为 `/admin/api/stats`
  - 技术细节: 使用 Oak Router 的 prefix() 方法，这是 Oak 框架的标准路由前缀设置方式

## Problem Analysis

### Root Cause
原代码中 Admin 路由没有设置路径前缀，导致路由无法正确匹配：

1. **错误尝试**: 在 main.ts 中使用 `app.use('/admin', adminRouter.routes())`
   - 问题: Oak 不支持这种语法
   - Oak 标准模式: `app.use()` 直接挂载路由器，路径前缀应在路由器内部设置

2. **正确解决方案**: 在 adminRouter 内部使用 `router.prefix("/admin")`
   - 符合 Oak 框架设计模式
   - 与其他路由器（configRouter、healthRouter）保持一致
   - 路由路径保持简洁（`/` 而不是 `/admin`）

### Key Changes
1. **src/presentation/api/admin.route.ts 第 11 行**
   - 添加: `router.prefix("/admin");`
   - 更新注释说明 prefix 的作用
   - 移除错误的注释说明

2. **src/main.ts 第 165-166 行**
   - 保持标准模式: `app.use(adminRouter.routes())`
   - 不再尝试在 app.use() 中设置路径前缀

## Outputs for Dependent Tasks

### Available Routes
```
// Admin 路由现在可以正常访问
GET /admin              - 管理面板首页 (HTML)
GET /admin/api/stats    - 统计信息 API (JSON)
GET /admin/api/sources  - 源配置列表 API (JSON)
POST /admin/api/sources/:id/toggle - 切换源状态
POST /admin/api/sources/:id/test   - 测试单个源
POST /admin/api/cache/clear        - 清空缓存
POST /admin/api/health/check       - 触发健康检查
```

### Integration Points
- **Admin UI**: 访问 http://localhost:8000/admin 查看管理面板
- **API Endpoints**: 所有 Admin API 端点都在 `/admin/api/*` 路径下
- **前端调用**: Admin 页面内的 JavaScript 使用相对路径（如 `/admin/api/stats`）

### Usage Examples
```bash
# 获取管理页面
curl http://localhost:8000/admin

# 获取统计信息
curl http://localhost:8000/admin/api/stats

# 获取源列表
curl http://localhost:8000/admin/api/sources
```

## Verification Results

### Test Results
All three required endpoints tested successfully:

1. **GET /admin** - Status: 200 OK
   - Returns: HTML page with title "TVBox 聚合服务 - 管理面板"
   - Content: Full admin dashboard UI

2. **GET /admin/api/stats** - Status: 200 OK
   - Returns: JSON object with statistics
   - Sample response:
     ```json
     {
       "totalRequests": 5305,
       "todayRequests": 562,
       "avgResponseTime": 316,
       "uptime": "2d 5h 32m",
       "sources": {"total": 7, "healthy": 6, "degraded": 1, "failed": 0},
       "cache": {"hitRate": 0.72, "size": "45.2 KB", "entries": 12},
       "lastUpdated": "2026-01-13T01:40:58.068Z"
     }
     ```

3. **GET /admin/api/sources** - Status: 200 OK
   - Returns: JSON array of 7 source configurations
   - Includes: fantaiying, qingning, weixine, feimao-github, gitlab-apps, agit-apps, tv58888

### Quality Standards Met
- [x] 1 个文件已修改: src/presentation/api/admin.route.ts 第 11 行添加 prefix
- [x] 3 个端点返回 200: 所有端点测试通过
- [x] 管理页面可访问: 包含 "TVBox 聚合服务" 文字

## Status: ✅ Complete

**Task completed successfully!** Admin routes are now accessible and all endpoints return proper responses.
