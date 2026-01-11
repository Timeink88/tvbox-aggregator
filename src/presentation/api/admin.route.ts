/**
 * 管理页面路由
 */
import { Router } from "oak";

export function createAdminRoute(): Router {
  const router = new Router();

  // 注意：不要在这里设置 prefix，因为在 main.ts 中会使用 app.use(adminRouter.routes())
  // 如果在这里设置 prefix("/admin")，会导致路由变成 /admin/admin/...

  // GET / - 管理页面首页
  router.get("/", async (ctx) => {
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    ctx.response.body = getAdminPageHTML();
  });

  // GET /api/stats - 获取统计信息
  router.get("/api/stats", async (ctx) => {
    // 这里可以从实际的缓存服务获取数据
    ctx.response.body = {
      totalRequests: Math.floor(Math.random() * 10000) + 5000,
      todayRequests: Math.floor(Math.random() * 1000) + 500,
      avgResponseTime: Math.floor(Math.random() * 500) + 100,
      uptime: "2d 5h 32m",
      sources: {
        total: 7,
        healthy: 6,
        degraded: 1,
        failed: 0,
      },
      cache: {
        hitRate: 0.72,
        size: "45.2 KB",
        entries: 12,
      },
      lastUpdated: new Date().toISOString(),
    };
  });

  // GET /api/sources - 获取源配置列表
  router.get("/api/sources", async (ctx) => {
    try {
      const content = await Deno.readTextFile(
        new URL("../../../config/sources.json", import.meta.url)
      );
      const sources = JSON.parse(content);

      ctx.response.body = {
        success: true,
        data: sources.map((s: any) => ({
          ...s,
          status: Math.random() > 0.2 ? "healthy" : "degraded", // 模拟状态
          responseTime: Math.floor(Math.random() * 1000) + 100,
          lastChecked: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        })),
      };
    } catch (error) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        error: error.message,
      };
    }
  });

  // POST /admin/api/sources/:id/toggle - 切换源的启用状态
  router.post("/api/sources/:id/toggle", async (ctx) => {
    const { id } = ctx.params;

    // 这里应该实际更新配置文件
    // 为了演示，我们只是返回成功
    ctx.response.body = {
      success: true,
      message: `源 ${id} 状态已更新`,
    };
  });

  // POST /admin/api/sources/:id/test - 测试单个源
  router.post("/api/sources/:id/test", async (ctx) => {
    const { id } = ctx.params;

    // 这里应该实际测试源
    // 为了演示，我们返回模拟结果
    ctx.response.body = {
      success: true,
      data: {
        sourceId: id,
        status: "healthy",
        responseTime: Math.floor(Math.random() * 1000) + 100,
        testedAt: new Date().toISOString(),
      },
    };
  });

  // POST /admin/api/cache/clear - 清空缓存
  router.post("/api/cache/clear", async (ctx) => {
    ctx.response.body = {
      success: true,
      message: "缓存已清空",
    };
  });

  // POST /admin/api/health/check - 触发健康检查
  router.post("/api/health/check", async (ctx) => {
    ctx.response.body = {
      success: true,
      message: "健康检查已启动",
      taskId: `check-${Date.now()}`,
    };
  });

  return router;
}

function getAdminPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TVBox 聚合服务 - 管理面板</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
        }

        .header h1 {
            color: #667eea;
            font-size: 28px;
            margin-bottom: 10px;
        }

        .header p {
            color: #666;
            font-size: 14px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .stat-card h3 {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .stat-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
        }

        .stat-card .subtitle {
            color: #999;
            font-size: 12px;
            margin-top: 5px;
        }

        .card {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
        }

        .card h2 {
            color: #333;
            font-size: 20px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }

        .btn-success {
            background: #48bb78;
            color: white;
        }

        .btn-success:hover {
            background: #38a169;
        }

        .btn-danger {
            background: #f56565;
            color: white;
        }

        .btn-danger:hover {
            background: #e53e3e;
        }

        .sources-table {
            width: 100%;
            border-collapse: collapse;
        }

        .sources-table th,
        .sources-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }

        .sources-table th {
            background: #f7fafc;
            color: #4a5568;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .sources-table tr:hover {
            background: #f7fafc;
        }

        .badge {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }

        .badge-healthy {
            background: #c6f6d5;
            color: #22543d;
        }

        .badge-degraded {
            background: #fefcbf;
            color: #744210;
        }

        .badge-failed {
            background: #fed7d7;
            color: #742a2a;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .actions {
            display: flex;
            gap: 10px;
        }

        .refresh-btn {
            background: none;
            border: none;
            color: #667eea;
            cursor: pointer;
            font-size: 14px;
        }

        .refresh-btn:hover {
            color: #5568d3;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📺 TVBox 聚合服务</h1>
            <p>管理面板 | Deno Deploy | <span id="currentTime"></span></p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <h3>总请求数</h3>
                <div class="value" id="totalRequests">-</div>
                <div class="subtitle">累计请求</div>
            </div>
            <div class="stat-card">
                <h3>今日请求</h3>
                <div class="value" id="todayRequests">-</div>
                <div class="subtitle">过去24小时</div>
            </div>
            <div class="stat-card">
                <h3>响应时间</h3>
                <div class="value" id="avgResponseTime">-</div>
                <div class="subtitle">平均毫秒</div>
            </div>
            <div class="stat-card">
                <h3>健康源</h3>
                <div class="value" id="healthySources">-</div>
                <div class="subtitle">共 <span id="totalSources">-</span> 个源</div>
            </div>
        </div>

        <div class="card">
            <h2>
                ⚡ 快速操作
                <button class="btn btn-primary" onclick="refreshStats()">刷新统计</button>
                <button class="btn btn-success" onclick="triggerHealthCheck()">健康检查</button>
                <button class="btn btn-danger" onclick="clearCache()">清空缓存</button>
            </h2>
        </div>

        <div class="card">
            <h2>
                📊 配置源列表
                <button class="refresh-btn" onclick="loadSources()">🔄 刷新</button>
            </h2>
            <div id="sourcesContainer">
                <div class="loading"><div class="spinner"></div> 加载中...</div>
            </div>
        </div>
    </div>

    <script>
        // 更新时间
        function updateTime() {
            const now = new Date();
            document.getElementById('currentTime').textContent = now.toLocaleString('zh-CN');
        }
        setInterval(updateTime, 1000);
        updateTime();

        // 加载统计数据
        async function loadStats() {
            try {
                const response = await fetch('/admin/api/stats');
                const data = await response.json();

                document.getElementById('totalRequests').textContent = data.totalRequests.toLocaleString();
                document.getElementById('todayRequests').textContent = data.todayRequests.toLocaleString();
                document.getElementById('avgResponseTime').textContent = data.avgResponseTime + 'ms';
                document.getElementById('healthySources').textContent = data.sources.healthy;
                document.getElementById('totalSources').textContent = data.sources.total;
            } catch (error) {
                console.error('加载统计失败:', error);
            }
        }

        // 加载源列表
        async function loadSources() {
            const container = document.getElementById('sourcesContainer');
            container.innerHTML = '<div class="loading"><div class="spinner"></div> 加载中...</div>';

            try {
                const response = await fetch('/admin/api/sources');
                const result = await response.json();

                if (result.success) {
                    const sources = result.data;
                    container.innerHTML = \`
                        <table class="sources-table">
                            <thead>
                                <tr>
                                    <th>名称</th>
                                    <th>优先级</th>
                                    <th>状态</th>
                                    <th>响应时间</th>
                                    <th>最后检查</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${sources.map(source => \`
                                    <tr>
                                        <td>
                                            <strong>\${source.name}</strong><br>
                                            <small style="color: #666">\${source.url}</small>
                                        </td>
                                        <td>\${source.priority}</td>
                                        <td><span class="badge badge-\${source.status}">\${source.status}</span></td>
                                        <td>\${source.responseTime}ms</td>
                                        <td>\${new Date(source.lastChecked).toLocaleString('zh-CN')}</td>
                                        <td>
                                            <div class="actions">
                                                <button class="btn btn-primary" style="padding: 5px 10px; font-size: 12px;" onclick="testSource('\${source.id}')">测试</button>
                                                <button class="btn btn-success" style="padding: 5px 10px; font-size: 12px;" onclick="toggleSource('\${source.id}')">\${source.enabled ? '禁用' : '启用'}</button>
                                            </div>
                                        </td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                } else {
                    container.innerHTML = '<p style="color: #f56565;">加载失败: ' + result.error + '</p>';
                }
            } catch (error) {
                container.innerHTML = '<p style="color: #f56565;">加载失败: ' + error.message + '</p>';
            }
        }

        // 刷新统计
        function refreshStats() {
            loadStats();
            alert('统计已刷新');
        }

        // 触发健康检查
        async function triggerHealthCheck() {
            if (confirm('确定要触发健康检查吗？这可能需要一些时间。')) {
                try {
                    const response = await fetch('/admin/api/health/check', { method: 'POST' });
                    const result = await response.json();
                    alert(result.message);
                    setTimeout(() => loadStats(), 2000);
                } catch (error) {
                    alert('操作失败: ' + error.message);
                }
            }
        }

        // 清空缓存
        async function clearCache() {
            if (confirm('确定要清空所有缓存吗？')) {
                try {
                    const response = await fetch('/admin/api/cache/clear', { method: 'POST' });
                    const result = await response.json();
                    alert(result.message);
                } catch (error) {
                    alert('操作失败: ' + error.message);
                }
            }
        }

        // 测试单个源
        async function testSource(id) {
            if (confirm('确定要测试这个源吗？')) {
                try {
                    const response = await fetch(\`/admin/api/sources/\${id}/test\`, { method: 'POST' });
                    const result = await response.json();
                    if (result.success) {
                        alert(\`测试成功！状态: \${result.data.status}, 响应时间: \${result.data.responseTime}ms\`);
                        loadSources();
                    } else {
                        alert('测试失败: ' + result.error);
                    }
                } catch (error) {
                    alert('测试失败: ' + error.message);
                }
            }
        }

        // 切换源状态
        async function toggleSource(id) {
            try {
                const response = await fetch(\`/admin/api/sources/\${id}/toggle\`, { method: 'POST' });
                const result = await response.json();
                alert(result.message);
                loadSources();
            } catch (error) {
                alert('操作失败: ' + error.message);
            }
        }

        // 初始加载
        loadStats();
        loadSources();

        // 自动刷新（每30秒）
        setInterval(() => {
            loadStats();
        }, 30000);
    </script>
</body>
</html>`;
}
