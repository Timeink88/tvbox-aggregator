# TVBox 配置聚合服务

基于 Deno Deploy 的 TVBox 配置源聚合服务，支持多平台部署。

## ✨ 特性

- 🚀 **高性能**: 三级缓存，响应时间 <500ms
- 🌍 **国内友好**: Deno Deploy 部署，国内直连访问
- 🔌 **跨平台**: 支持 Deno/Cloudflare/Vercel
- 🏥 **健康检查**: 自动验证源可用性
- 📦 **模块化**: 清晰的架构，易于维护

## 📺 推荐配置源（2025年1月验证有效）

| 优先级 | 名称 | URL | 状态 |
|-------|------|-----|------|
| 100 | 饭太硬 | http://www.xn--sss604efuw.com/tv/ | ✅ 有效 |
| 95 | 青柠 | https://github.com/Zhou-Li-Bin/Tvbox-QingNing/raw/main/json/green.json | ✅ 有效 |
| 90 | weixine | https://weixine.net/ysc.json | ✅ 有效 |
| 85 | 肥猫镜像 | https://github.com/Ftindy/IPTV/raw/main/json/ft.json | ✅ 有效 |
| 80 | GitLab Apps | https://gitlab.com/duomv/apps/-/raw/main/fast.json | ✅ 有效 |
| 75 | Agit Apps | https://agit.ai/leevi/apps/raw/branch/main/fast.json | ✅ 有效 |

## 🚀 快速开始

### 本地开发

```bash
# 1. 安装 Deno
curl -fsSL https://deno.land/install.sh | sh

# 2. 运行开发服务器
deno task dev

# 3. 访问 http://localhost:8000
```

### 部署到 Deno Deploy

```bash
# 1. 登录 Deno
deno login

# 2. 部署
deno task deploy
```

## 📖 API 文档

### 获取聚合配置

```http
GET /api/config
```

响应示例：
```json
{
  "version": "2025-01-11",
  "sources": [
    {
      "name": "饭太硬",
      "url": "http://www.xn--sss604efuw.com/tv/",
      "icon": "...",
      "priority": 100,
      "status": "healthy"
    }
  ],
  "total": 95,
  "healthy": 58,
  "generatedAt": "2025-01-11T12:00:00Z",
  "cacheTTL": 3600
}
```

### 获取健康状态

```http
GET /api/health
```

### 触发健康检查

```http
POST /api/health/check
```

## 🏗️ 项目结构

```
tvbox-aggregator/
├── src/
│   ├── application/      # 应用层（业务逻辑）
│   ├── domain/          # 领域层（核心实体）
│   ├── infrastructure/  # 基础设施层（适配器）
│   ├── presentation/    # 表现层（API）
│   └── shared/          # 共享工具
├── config/              # 配置文件
├── tests/               # 测试
└── scripts/             # 脚本
```

## 🔧 配置

编辑 `config/sources.json` 添加或修改配置源。

## 📊 监控

访问 `/api/stats` 查看系统统计信息。

## 📝 许可证

MIT License

## 🙏 致谢

- [TVBox](https://github.com/tvbox) - 开源播放器
- [Deno Deploy](https://deno.com/deploy) - 部署平台

---

**来源参考**：
- [TvBOX最新源接口-2025年5月6日](https://zhuanlan.zhihu.com/p/1903125079400903629)
- [独立开发者云平台技术选型深度对比](https://frytea.com/archives/1503/)
- [2025年TVBox生态接口配置与多仓方案优化指南](https://comate.baidu.com/zh/page/zn3zecdtlws)
- [CloudFlare workers.dev域名DNS污染国内无法访问解决办法](https://cloud.tencent.com/developer/article/2133923)
