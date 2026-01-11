#!/bin/bash
# 验证配置源可用性

echo "🔍 开始验证配置源..."

deno run --allow-net --allow-read \
  scripts/validate-sources.ts

echo "✅ 验证完成！"
echo "📊 查看报告: cat reports/health-*.json"
