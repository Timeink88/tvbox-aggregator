# Tasks: 修复配置数据不一致和缺失接口问题

## Task Progress

### Phase 1: 快速修复 (Admin 路由 + Config API)
- [x] **IMPL-001**: 修复 Admin 路由 404 错误 → [📋](./.task/IMPL-001.json) | [✅](./.summaries/IMPL-001-summary.md)
  - **修改**: `src/presentation/api/admin.route.ts:11` 添加 `router.prefix("/admin")`
  - **验证**: Admin 界面可访问，3 个端点返回 200
- [x] **IMPL-002**: 诊断并修复 Config API 返回空数组问题 → [📋](./.task/IMPL-002.json) | [✅](./.summaries/IMPL-002-summary.md)
  - **修改**: `aggregate-config.use-case.ts` 默认 `excludeFailed: false` + `config.route.ts` 参数解析修复
  - **验证**: `/api/config` 返回 7 个源，响应时间 310ms

### Phase 2: 深度调查 (Health/Stats 数据统一)
- [ ] **IMPL-003**: 调查 Health/Stats 数据不一致问题 → [📋](./.task/IMPL-003.json)
  - **分析**: 对比两个 API 的数据来源
  - **输出**: 定位不一致根本原因
- [ ] **IMPL-004**: 优化 Health Check 验证逻辑 → [📋](./.task/IMPL-004.json)
  - **修改**: `source-validator.service.ts` 验证策略
  - **验证**: 至少 3 个源标记为 healthy/degraded
- [ ] **IMPL-005**: 修复 Stats API 数据源并统一健康状态 → [📋](./.task/IMPL-005.json)
  - **修改**: `stats.route.ts` 和 `admin.route.ts` 使用真实数据
  - **验证**: Health/Stats/Admin 数据一致

### Phase 3: 验证测试 (集成测试)
- [ ] **IMPL-006**: 集成测试和端到端验证 → [📋](./.task/IMPL-006.json)
  - **创建**: `tests/integration/api-integration.test.ts`
  - **验证**: 所有测试通过，覆盖率 ≥80%

## 执行计划

### 建议执行顺序
1. **并行启动** (可选): IMPL-001 + IMPL-002 (独立修复，可并行)
2. **顺序执行**: IMPL-003 → IMPL-004 → IMPL-005 (连续调查流程)
3. **最终验证**: IMPL-006 (所有修复完成后测试)

### 批量执行命令
```bash
# 快速修复阶段 (可并行)
cd /d/Code/tvbox && \
deno task dev &  # 启动开发服务器

# 等待服务器启动后验证
sleep 5
curl -s http://localhost:8000/admin | grep "TVBox"
curl -s http://localhost:8000/api/config | jq '.total'

# 集成测试阶段
deno test --allow-all tests/integration/
deno test --coverage --allow-all tests/integration/
```

## 依赖关系图

```
IMPL-001 (Admin 路由)
    ↓
    └─→ IMPL-006 (集成测试) ✓

IMPL-002 (Config API)
    ↓
    └─→ IMPL-006 (集成测试) ✓

IMPL-003 (调查问题)
    ↓
IMPL-004 (优化验证)
    ↓
IMPL-005 (修复 Stats)
    ↓
    └─→ IMPL-006 (集成测试) ✓
```

## 状态说明

- `- [ ]` = 待执行 (Pending)
- `- [x]` = 已完成 (Completed)
- `- [~]` = 执行中 (In Progress)
- `- [-]` = 已阻塞 (Blocked)

## 快速链接

- [IMPL_PLAN.md](./IMPL_PLAN.md) - 完整实施计划
- [.task/](./.task/) - 任务 JSON 文件目录
- [工作流会话](./workflow-session.json) - 会话元数据

---

**生成时间**: 2026-01-13
**会话 ID**: WFS-fix-config-data-inconsistency
**任务总数**: 6
**预计时间**: 2-3 小时
