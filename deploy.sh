#!/bin/bash
# TVBox 聚合服务 - 一键部署脚本 (macOS/Linux)

echo "========================================"
echo "   TVBox 聚合服务 - 一键部署脚本"
echo "========================================"
echo ""

# 检查 Deno 是否安装
echo "[1/4] 检查 Deno 安装..."
if ! command -v deno &> /dev/null; then
    echo "❌ Deno 未安装！"
    echo "请先运行: curl -fsSL https://deno.land/install.sh | sh"
    exit 1
fi
echo "✅ Deno 已安装"
echo ""

# 检查登录状态
echo "[2/4] 检查登录状态..."
deno task --help &> /dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  需要先登录 Deno"
    echo "正在打开浏览器..."
    deno login
fi
echo "✅ 登录状态正常"
echo ""

# 进入项目目录
echo "[3/4] 进入项目目录..."
cd "$(dirname "$0")"
echo "✅ 项目目录: $(pwd)"
echo ""

# 部署
echo "[4/4] 开始部署到 Deno Deploy..."
echo ""
echo "========================================"
echo "   正在部署，请稍候..."
echo "========================================"
echo ""

deno run --allow-net --allow-read https://deno.land/x/deployctl/deployctl.ts deploy \
  --project=tvbox-aggregator \
  --entrypoint=src/main.ts \
  --prod

echo ""
echo "========================================"
echo "   部署完成！"
echo "========================================"
echo ""
echo "🌐 访问地址："
echo "   - 服务: https://tvbox-aggregator.deno.dev"
echo "   - 管理面板: https://tvbox-aggregator.deno.dev/admin"
echo ""
