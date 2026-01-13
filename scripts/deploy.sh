#!/bin/bash
# 部署到 Deno Deploy

set -e

PROJECT_NAME="tvbox-aggregator"
ENTRYPOINT="src/main.ts"

echo "🚀 开始部署到 Deno Deploy"

# 检查是否登录
if ! deno task --help &> /dev/null; then
    echo "❌ Deno 未安装，请先安装: curl -fsSL https://deno.land/install.sh | sh"
    exit 1
fi

# 1. 类型检查
echo "📝 类型检查..."
deno check --remote $ENTRYPOINT

# 2. 运行测试（如果有）
echo "🧪 运行测试..."
# deno test --allow-all

# 3. 部署
echo "📦 部署中..."
deno install -A -f https://deno.land/x/deployctl/deployctl.ts

deployctl deploy \
  --project=$PROJECT_NAME \
  --entrypoint=$ENTRYPOINT \
  --prod

echo "✅ 部署完成！"
echo "🌐 访问: https://tvbox-aggregator.deno.dev"
echo "📊 健康检查: https://tvbox-aggregator.deno.dev/api/health"
