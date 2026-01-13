# TVBox 配置聚合服务 - 部署指南

## 部署前准备

### 1. 安装 Deno

```bash
# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex
```

### 2. 登录 Deno Deploy

```bash
deno login
```

## 部署方式

### 方式一：自动部署（推荐）

```bash
# 一键部署
deno task deploy
```

### 方式二：手动部署

```bash
# 1. 安装 deployctl
deno install -A -f https://deno.land/x/deployctl/deployctl.ts

# 2. 部署
deployctl deploy --project=tvbox-aggregator --entrypoint=src/main.ts --prod
```

## 部署后验证

```bash
# 检查服务状态
curl https://tvbox-aggregator.deno.dev/

# 获取配置
curl https://tvbox-aggregator.deno.dev/api/config

# 健康检查
curl https://tvbox-aggregator.deno.dev/api/health
```

## 多平台部署

### Cloudflare Workers

1. 安装 Wrangler:
```bash
npm install -g wrangler
wrangler login
```

2. 创建 KV Namespace:
```bash
wrangler kv:namespace create "CACHE"
```

3. 部署:
```bash
wrangler deploy
```

### Vercel Edge

1. 安装 Vercel CLI:
```bash
npm install -g vercel
vercel login
```

2. 部署:
```bash
vercel --prod
```

## 环境变量配置

```bash
# Deno Deploy
# 在部署时设置环境变量

# Cloudflare Workers
# 在 wrangler.toml 中配置

# Vercel
# 在 .env 文件中配置
```

## 监控和日志

### Deno Deploy

访问 Deno Deploy 控制台查看实时日志

### Cloudflare Workers

```bash
wrangler tail
```

### Vercel

```bash
vercel logs
```

## 故障排查

### 问题：部署失败

**解决方案：**
1. 检查代码语法: `deno check --remote src/main.ts`
2. 查看错误日志
3. 确认环境变量配置正确

### 问题：源验证失败

**解决方案：**
1. 运行健康检查: `deno task health`
2. 查看报告: `cat reports/health-*.json`
3. 更新失效的源: 编辑 `config/sources.json`

### 问题：缓存不生效

**解决方案：**
1. 检查 KV 配置
2. 清空缓存: 调用 `/api/stats` 接口
3. 重启服务

## CI/CD 配置

参考 `.github/workflows/deploy.yml` 配置 GitHub Actions 自动部署。

## 回滚

### Deno Deploy

```bash
# 列出部署历史
deployctl list --project=tvbox-aggregator

# 回滚到上一个版本
deployctl rollback --project=tvbox-aggregator
```

### Cloudflare Workers

```bash
wrangler rollback
```

## 性能优化

### 1. 启用缓存

默认已启用三级缓存，可通过环境变量调整：

```bash
CACHE_L1_TTL=300  # L1缓存5分钟
CACHE_L2_TTL=3600 # L2缓存1小时
```

### 2. 限制并发数

在 `config/sources.json` 中调整 `maxDepth` 和并发数。

### 3. 使用 CDN

配置自定义域名并启用 CDN 加速。

## 安全建议

1. **定期更新依赖**: `deno cache --reload src/main.ts`
2. **监控异常日志**: 设置告警通知
3. **限制访问频率**: 使用 API 网关
4. **HTTPS 强制**: 所有部署平台都支持免费 SSL

## 备份和恢复

### 备份配置

```bash
# 备份源配置
cp config/sources.json config/sources.json.backup

# 备份 KV 数据（如果需要）
# Deno Deploy 暂不支持导出 KV 数据
```

### 恢复配置

```bash
# 恢复源配置
cp config/sources.json.backup config/sources.json
```

## 联系支持

- Deno Deploy 文档: https://deno.com/deploy/docs
- Cloudflare Workers 文档: https://developers.cloudflare.com/workers/
- Vercel 文档: https://vercel.com/docs
