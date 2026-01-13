# 更新日志

所有重要变更都将记录在此文件中。

## [2025-01-13]

### 新增 ✨
- 默认启用配置合并功能,API 默认返回完整的 TVBox JSON 配置

### 变更 🔄
**破坏性变更 - includeContent 默认值调整:**
- `includeContent` 参数默认值从 `false` 改为 `true`
- 默认请求 `GET /api/config` 现在会包含 `merged_config` 字段
- 影响范围:所有未显式传递 `includeContent` 参数的 API 调用

### 迁移指南 📚

**旧行为 (2025-01-13 之前):**
```bash
# 之前需要显式启用合并
curl "http://localhost:8000/api/config?includeContent=true"
```

**新行为 (2025-01-13 及之后):**
```bash
# 现在默认返回合并配置
curl "http://localhost:8000/api/config"

# 如需旧行为(只返回源列表),显式禁用合并
curl "http://localhost:8000/api/config?includeContent=false"
```

### 性能影响 ⚡
- 首次请求: 约 2-5s (取决于源数量和网络状况)
- 缓存命中: < 500ms
- 缓存策略: 三级缓存(Map缓存 5分钟 + KV缓存 1小时)

### 向后兼容性 ✅
- 完全向后兼容
- 显式传递 `includeContent=false` 可恢复旧行为
- 现有客户端无需修改,如需禁用合并可传递参数

### 相关文件
- `src/application/use-cases/aggregate-config.use-case.ts` - 修改默认值
- `src/presentation/api/v1/config.route.ts` - 修复参数覆盖问题
- `README.md` - 更新 API 文档

---

## [2025-01-11]

### 新增 ✨
- 初始版本发布
- 支持多源配置聚合
- 三级缓存机制
- 健康检查功能
