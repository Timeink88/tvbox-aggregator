# 🚀 手动部署指南

## 步骤 1: 访问 Deno Deploy Dashboard
1. 打开浏览器访问: https://dash.deno.com/projects/tvbox-aggregator
2. 登录你的 Deno 账户

## 步骤 2: 配置部署设置
1. 进入项目设置
2. 确认以下配置:
   - Entry Point: `src/main.ts`
   - Project: `tvbox-aggregator`

## 步骤 3: 触发部署
### 方式 A: 从 GitHub 部署（最简单）
1. 在项目设置中，连接 GitHub 仓库
2. 选择分支: `main`
3. 点击 "Deploy" 按钮

### 方式 B: 手动上传部署
1. 点击 "Manual Deploy"
2. 上传项目文件或从 GitHub 导入

## 步骤 4: 验证部署
部署完成后，访问:
- API: https://tvbox-aggregator-9wrw7g2ayzky.timeink88.deno.net/api/config
- 应该返回完整的 TVBox JSON 配置（包含 sites, lives, parses 等字段）
