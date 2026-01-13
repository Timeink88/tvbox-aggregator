# 🚀 GitHub 上传指南

## ✅ 已完成的准备工作

1. ✅ 删除临时文件 (CODE_*.md, FIXES_*.md 等)
2. ✅ 创建 .gitignore 配置
3. ✅ 初始化 Git 仓库
4. ✅ 创建首次提交 (36 个文件, 3896 行代码)

---

## 📋 接下来的步骤

### 步骤 1: 创建 GitHub 仓库

1. 访问: **https://github.com/new**
2. 填写仓库信息:
   - **Repository name**: `tvbox-aggregator`
   - **Description**: `TVBox配置聚合服务 - 多源聚合、缓存、健康检查`
   - **可见性**: 选择 **Public** (免费部署需要)
   - **不要**勾选 "Add a README file" (我们已经有了)
   - **不要**勾选 "Add .gitignore" (我们已经有了)
3. 点击: **"Create repository"**

### 步骤 2: 推送代码到 GitHub

创建好仓库后,GitHub 会显示推送命令。

**运行以下命令** (替换 `YOUR_USERNAME`):

```bash
cd D:\Code\tvbox

# 添加远程仓库 (替换 YOUR_USERNAME 为你的 GitHub 用户名)
git remote add origin https://github.com/YOUR_USERNAME/tvbox-aggregator.git

# 重命名分支为 main
git branch -M main

# 推送代码
git push -u origin main
```

**示例** (如果你的用户名是 `zhangsan`):
```bash
git remote add origin https://github.com/zhangsan/tvbox-aggregator.git
git branch -M main
git push -u origin main
```

### 步骤 3: 在 Deno Deploy 部署

1. 访问: **https://deno.com/deploy**
2. 点击: **"New Project"**
3. 选择: **"Deploy from GitHub"**
4. 授权 Deno Deploy 访问你的 GitHub (首次需要)
5. 选择: `tvbox-aggregator` 仓库
6. 配置:
   - **Entry Point**: `src/main.ts`
   - **Args**: 留空
7. 点击: **"Link and Deploy"**
8. 等待部署完成 (通常 1-2 分钟)

### 步骤 4: 验证部署

部署成功后，你会得到一个 `.deno.dev` 域名，例如:
```
https://tvbox-aggregator.deno.dev
```

**测试接口**:

```bash
# 测试主页
curl https://tvbox-aggregator.deno.dev/

# 测试配置接口
curl https://tvbox-aggregator.deno.dev/api/config

# 测试健康检查
curl https://tvbox-aggregator.deno.dev/api/health

# 测试统计
curl https://tvbox-aggregator.deno.dev/api/stats
```

**管理面板**:
```
浏览器访问: https://tvbox-aggregator.deno.dev/admin
```

---

## 🔑 可能需要 GitHub 认证

### 如果使用 HTTPS (推荐)

首次推送时，GitHub 可能会要求你认证：

**方式 1: Personal Access Token** (推荐)

1. 生成 Token:
   - 访问: https://github.com/settings/tokens
   - 点击: "Generate new token" → "Generate new token (classic)"
   - 勾选: `repo` (全部权限)
   - 点击: "Generate token"
   - 复制生成的 token

2. 推送时:
   - 用户名: `YOUR_USERNAME`
   - 密码: `粘贴刚才的 token` (不是你的 GitHub 密码!)

**方式 2: GitHub CLI** (最简单)

```bash
# 安装 GitHub CLI
# Windows: winget install GitHub.cli

# 登录
gh auth login

# 推送
git push -u origin main
```

---

## 📊 仓库内容概览

### 代码文件 (17 个)
```
src/
├── main.ts                           # 入口文件
├── application/                      # 应用层
│   ├── services/cache-manager.service.ts
│   └── use-cases/
│       ├── aggregate-config.use-case.ts
│       └── health-check.use-case.ts
├── domain/                           # 领域层
│   ├── entities/config-source.entity.ts
│   └── services/source-validator.service.ts
├── infrastructure/                   # 基础设施层
│   └── adapters/
│       ├── interfaces/
│       ├── runtime/
│       └── storage/
└── presentation/                     # 表现层
    └── api/
        ├── admin.route.ts           # 管理面板
        ├── v1/
        │   ├── config.route.ts
        │   ├── health.route.ts
        │   └── stats.route.ts
        └── middleware/
            ├── cache.middleware.ts
            ├── cors.middleware.ts
            └── error-handler.middleware.ts
```

### 配置文件
- `deno.json` - Deno 配置
- `config/sources.json` - 源配置 (7个已验证源)

### 文档
- `README.md` - 主要说明
- `DEPLOYMENT.md` - 详细部署指南
- `QUICK_DEPLOY.md` - 快速部署
- `docs/ADMIN_PANEL.md` - 管理面板文档
- `docs/deployment.md` - 部署文档

### 脚本
- `deploy-windows.bat` - Windows 一键部署
- `deploy.sh` - Linux/Mac 部署
- `scripts/validate-sources.ts` - 源验证工具

---

## ✅ 检查清单

在上传前，请确认:

- [ ] 已有 GitHub 账号
- [ ] 已创建 GitHub 仓库 (Public)
- [ ] 已将代码推送到 GitHub
- [ ] 在 Deno Deploy 连接了仓库
- [ ] 部署成功，获得 .deno.dev 域名
- [ ] 测试了所有 API 接口
- [ ] 访问了管理面板 (/admin)

---

## 🎯 完成!

你的 TVBox 聚合服务将会运行在:
```
https://tvbox-aggregator.deno.dev
```

**管理面板**: `https://tvbox-aggregator.deno.dev/admin`

**API 接口**:
- `/api/config` - 获取聚合配置
- `/api/health` - 健康检查
- `/api/stats` - 统计信息

---

## 🆘 遇到问题?

### 问题 1: git push 失败
```
error: failed to push some refs to
```
**解决**: 使用 Personal Access Token 而不是密码

### 问题 2: Deno Deploy 部署失败
**解决**:
- 检查 Entry Point 是否为 `src/main.ts`
- 查看部署日志，确认错误信息

### 问题 3: 接口返回 500 错误
**解决**:
- 检查 Deno Deploy 的日志
- 确认 `config/sources.json` 格式正确

---

## 📞 下一步

上传成功后:

1. ✅ 在 Deno Deploy 完成部署
2. ✅ 测试所有接口
3. ✅ 访问管理面板
4. ✅ 开始使用你的 TVBox 聚合服务!

---

**准备好了吗? 开始上传到 GitHub!** 🚀
