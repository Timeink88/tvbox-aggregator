---
identifier: WFS-fix-deno-deploy-api-routes-404
source: "用户要求: 修复 Deno Deploy API 路由 404 错误"
analysis: .workflow/active/WFS-fix-deno-deploy-api-routes-404/.process/
artifacts: 无 (直接 bugfix 工作流)
context_package: .workflow/active/WFS-fix-deno-deploy-api-routes-404/.process/context-package.json
workflow_type: "standard"
verification_history:
  concept_verify: "skipped"
  action_plan_verify: "pending"
phase_progression: "context → analysis → planning"
---

# 实施计划: 修复 Deno Deploy API 路由 404 错误

## 1. 摘要

本项目旨在修复 Deno Deploy 部署环境中 API 路由返回 404 错误的问题。虽然根路径 (/) 正确返回了端点列表,但实际访问 /api/config、/api/health、/api/stats 等路由时返回 404 错误。

**核心目标**:
- 修复 API 路由 404 错误,确保所有端点可访问
- 重构路由注册模式为标准 Oak 框架规范
- 保持代码一致性和可维护性

**技术方案**:
完全重构 src/main.ts 中的路由注册逻辑,从错误的手动中间件链模式改为标准 Oak 的 app.use() 模式,同时移除路由文件中的 router.prefix() 调用。

## 2. 上下文分析

### CCW 工作流上下文

**阶段进度**:
- ✅ 阶段 1: 上下文收集 (context-package.json: 9 个文件,4 个模块分析完成)
- ✅ 阶段 2: 增强分析 (3 个探索角度: architecture, error-handling, dataflow)
- ⏭️ 阶段 3: 概念验证 (跳过 - 直接 bugfix 工作流)
- ⏳ 阶段 4: 行动计划 (当前阶段 - 生成 IMPL_PLAN.md)

**质量门**:
- concept-verify: ⏭️ 跳过 (用户决策 - 直接问题修复)
- action-plan-verify: ⏳ 待执行 (推荐在 /workflow:execute 前执行)

**上下文包摘要**:
- **关注路径**: src/main.ts, src/presentation/api/v1/*.route.ts, src/presentation/api/admin.route.ts
- **关键文件**: src/main.ts (路由注册和 fetch handler), 3 个 API 路由文件
- **智能上下文**: 9 个文件,5 个模块,4 个内部依赖,1 个外部依赖 (Oak v12.6.1)

### 项目概况

- **类型**: Bugfix/Refactor
- **规模**: 单体应用,5 个路由端点,3 层架构
- **技术栈**: Deno, Oak v12.6.1, TypeScript, Deno Deploy
- **时间线**: 单次修复会话 (预计 2-4 小时)

### 模块结构

```
src/
├── main.ts                          # 应用入口,路由注册
├── presentation/
│   └── api/
│       ├── admin.route.ts           # Admin 路由 (工作正常)
│       ├── v1/
│       │   ├── config.route.ts      # 配置路由 (404 问题)
│       │   ├── health.route.ts      # 健康检查路由 (404 问题)
│       │   └── stats.route.ts       # 统计路由 (404 问题)
│       └── middleware/
│           ├── cors.middleware.ts
│           ├── error-handler.middleware.ts
│           └── cache.middleware.ts
├── application/
│   ├── use-cases/
│   │   ├── aggregate-config.use-case.ts
│   │   └── health-check.use-case.ts
│   └── services/
│       └── cache-manager.service.ts
└── infrastructure/
    └── adapters/
        └── runtime/
            └── deno.runtime.adapter.ts
```

### 依赖关系

**主要依赖**:
- Oak v12.6.1 (Web 框架)
- Deno (运行时)

**API 服务**:
- 外部配置源聚合

**开发工具**:
- deno check (类型检查)
- deno fmt (代码格式化)

### 模式与约定

- **架构模式**: 分层架构 (DDD), 依赖注入
- **组件设计**: Router 模式, Middleware 链
- **状态管理**: 无状态 (Deno Deploy serverless)
- **代码风格**: TypeScript 严格模式, 2 空格缩进

## 3. 头脑风暴工件引用

### 工件使用策略

**上下文智能包 (context-package.json)**:
- **内容**: 智能上下文包含项目结构、依赖图、关键文件分析、冲突检测
- **使用**: 任务通过 flow_control.pre_analysis 加载此上下文
- **价值**: 自动化的上下文发现,替代手动文件探索

**探索结果 (3 个角度)**:
- **架构探索** (exploration-architecture.json): 识别了路由注册模式不一致的根本原因
- **错误处理探索** (exploration-error-handling.json): 分析了 handled 标志逻辑错误
- **数据流探索** (exploration-dataflow.json): 追踪了请求流向和关键问题点

**冲突检测与缓解策略**:
- **风险等级**: HIGH
- **推荐方法**: 完全重构为标准 Oak 模式
- **缓解步骤**: 移除手动中间件链 → 移除 router.prefix() → 使用 app.use() 挂载 → 验证功能

### 集成规范 (最高优先级)

**根本原因** (来自探索结果聚合):
- src/main.ts:101-125 使用了错误的手动路由匹配模式
- handled 标志逻辑错误 (回调总是立即执行,handled 总是为 true)
- 路由注册模式不一致 (Admin 使用标准 app.use(), API 使用手动中间件链)

**推荐解决方案**:
```typescript
// 移除 API 路由文件中的 router.prefix('/api')
// 在 main.ts 中使用标准 Oak 模式:
app.use('/api', configRouter.routes());
app.use('/api', configRouter.allowedMethods());
app.use('/api', healthRouter.routes());
app.use('/api', healthRouter.allowedMethods());
app.use('/api', statsRouter.routes());
app.use('/api', statsRouter.allowedMethods());
```

## 4. 实施策略

### 执行策略

**执行模型**: 顺序执行

**理由**:
- IMPL-001 必须先完成 (移除 router.prefix()),否则后续重构会冲突
- IMPL-002 依赖于 IMPL-001 的修改
- IMPL-003 验证所有功能,必须在代码修改完成后执行
- IMPL-004 优化代码,在验证通过后进行

**并行化机会**: 无 (严格的任务依赖关系)

**序列化要求**:
- IMPL-001 → IMPL-002 (代码修改的先后顺序)
- IMPL-002 → IMPL-003 (必须先修改后验证)
- IMPL-003 → IMPL-004 (验证通过后优化)

### 架构方法

**关键架构决策**:
- 采用 Oak 官方推荐的路由注册模式 (app.use() + router.routes())
- 放弃手动中间件链模式 (不符合 Oak 设计理念)
- 路径前缀在 app.use() 中指定,不在路由文件中使用 prefix()

**集成策略**:
- 所有路由通过 app.use() 挂载到主应用
- 中间件链顺序: CORS → Error Handler → Cache → Root → Admin → API → OPTIONS
- 保持现有的分层架构和依赖注入模式

### 关键依赖

**任务依赖图**:
```
IMPL-001 (移除 prefix)
    ↓
IMPL-002 (重构路由注册)
    ↓
IMPL-003 (验证功能)
    ↓
IMPL-004 (优化代码)
```

**关键路径**: IMPL-001 → IMPL-002 → IMPL-003 (核心修复路径)

### 测试策略

**测试方法**:
- 手动功能测试: 使用 curl 测试所有端点
- 验证测试: 检查 HTTP 状态码和响应体
- 类型检查: deno check 确保无类型错误

**覆盖目标**:
- 所有路由端点: 100% (7 个端点)
- 代码修改区域: 100% (main.ts 路由注册部分)
- TypeScript 编译: 100% (无错误无警告)

**质量门**:
- TypeScript 编译通过 (deno check)
- 所有端点返回 200 (而非 404)
- Admin 路由保持正常工作

## 5. 任务分解摘要

### 任务数量
**4 个任务** (扁平层次结构,顺序执行)

### 任务结构

- **IMPL-001**: 移除 API 路由中的 router.prefix() 定义
  - 修改 3 个路由文件
  - 移除 router.prefix('/api') 调用
  - 保留路由定义和导出

- **IMPL-002**: 重构 main.ts 路由注册为标准 Oak 模式
  - 移除手动中间件链 (101-125 行)
  - 添加 6 个 app.use() 调用
  - 验证路由注册顺序

- **IMPL-003**: 验证路由功能并确认 404 问题解决
  - 启动应用
  - 测试 7 个端点
  - 创建测试文档

- **IMPL-004**: 优化和清理代码
  - 添加详细注释
  - 添加 JSDoc 注释
  - 确保代码风格一致性

### 复杂度评估

- **中等**: IMPL-002 (核心重构,需要理解 Oak 路由机制)
- **低**: IMPL-001, IMPL-003, IMPL-004 (简单修改和验证)

### 依赖关系

```
IMPL-001 (必须首先完成)
    ↓
IMPL-002 (依赖 IMPL-001)
    ↓
IMPL-003 (依赖 IMPL-002)
    ↓
IMPL-004 (依赖 IMPL-003)
```

**并行化机会**: 无 (严格的顺序依赖)

## 6. 实施计划 (详细阶段分解)

### 执行策略

**阶段 1 (会话 1): 路由文件重构**
- **任务**: IMPL-001
- **交付物**:
  - 3 个路由文件移除 router.prefix()
  - 路由导出和定义保留
- **成功标准**:
  - grep router.prefix 返回 0 结果
  - grep export 返回 3 个路由导出
  - deno check 无错误

**阶段 2 (会话 1): 核心路由注册重构**
- **任务**: IMPL-002
- **交付物**:
  - src/main.ts 移除手动中间件链 (25 行)
  - 添加 6 个标准 app.use() 调用
  - TypeScript 编译通过
- **成功标准**:
  - grep handled 返回 0 结果
  - grep app.use('/api') 返回 6 个结果
  - deno check 无错误

**阶段 3 (会话 2): 功能验证**
- **任务**: IMPL-003
- **交付物**:
  - 7 个端点测试通过
  - 测试文档 (test-results.md)
  - 所有问题确认解决
- **成功标准**:
  - 所有 API 路由返回 200
  - Admin 路由保持正常
  - 测试文档完整

**阶段 4 (会话 2): 代码优化**
- **任务**: IMPL-004
- **交付物**:
  - 添加详细注释和 JSDoc
  - 代码风格统一
  - 最终验证通过
- **成功标准**:
  - 注释覆盖率 ≥ 30%
  - deno fmt 通过
  - 所有功能仍正常

### 资源需求

**开发团队**:
- 全栈开发工程师 1 名 (熟悉 Deno 和 Oak)

**外部依赖**:
- Deno 运行时
- Oak v12.6.1 框架
- Deno Deploy (用于生产部署验证)

**基础设施**:
- 本地开发环境 (Deno CLI)
- curl 或类似 HTTP 测试工具

## 7. 风险评估与缓解

| 风险 | 影响 | 概率 | 缓解策略 | 负责人 |
|------|--------|--------|---------|--------|
| 重构后路由仍然返回 404 | 高 | 低 | 仔细遵循 Oak 官方文档,逐步验证每个步骤 | 开发者 |
| Admin 路由被破坏 | 中 | 低 | Admin 路由代码不修改,仅作为参考 | 开发者 |
| TypeScript 类型错误 | 中 | 中 | 使用 deno check 逐步验证,修改后立即检查 | 开发者 |
| Deno Deploy 环境差异 | 中 | 中 | 本地测试通过后,在 Deno Deploy 部署验证 | 开发者 |
| 路由顺序错误导致冲突 | 低 | 低 | 遵循推荐的中间件链顺序 | 开发者 |

**关键风险** (高影响 + 高概率): 无

**监控策略**:
- 每个任务完成后立即运行 deno check
- 每次修改后手动测试关键路由
- 记录所有测试结果用于回归测试

## 8. 成功标准

**功能完整性**:
- [ ] 3 个路由文件移除 router.prefix()
- [ ] main.ts 路由注册完全重构为标准 Oak 模式
- [ ] 7 个端点全部可访问且返回正确响应
- [ ] Admin 路由保持正常工作

**技术质量**:
- [ ] TypeScript 编译无错误 (deno check)
- [ ] 代码风格统一 (deno fmt)
- [ ] 注释覆盖率 ≥ 30%
- [ ] 测试文档完整

**运营就绪**:
- [ ] 所有端点返回 200 (有效路由) 或 404 (无效路由)
- [ ] CORS 预检请求正常处理
- [ ] 错误处理中间件正常工作

**业务指标**:
- [ ] 用户可以访问所有 API 端点
- [ ] 配置源聚合服务恢复正常
- [ ] 健康检查端点可用于监控
