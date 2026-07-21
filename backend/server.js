/* ============================================================
 * GitHub 趋势搜索 - 后端服务入口
 * ============================================================
 * 功能：
 *   1. 提供 RESTful API 供前端 / Hermes 等 agent 调用
 *   2. 代理 GitHub Search API，内置缓存以缓解限流
 *   3. 提供健康检查端点
 *
 * 环境变量：
 *   PORT          - 服务监听端口（默认 3000）
 *   GITHUB_TOKEN  - 可选，GitHub Personal Access Token，提升 API 限流
 *
 * 启动：
 *   npm start          - 生产启动
 *   npm run dev        - 开发模式（node --watch，Node 18.11+）
 * ============================================================ */

const path = require('path');

// 优先加载 .env，确保后续模块能读到环境变量
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes/api');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

/* ---------- 中间件 ---------- */

// CORS：允许前端 / Hermes 跨域调用
app.use(
  cors({
    origin: true, // 反射请求来源，开发阶段方便；生产环境建议限定域名
    credentials: false,
  })
);

// 请求体解析（虽然当前 API 全是 GET，但为未来扩展预留）
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });
  next();
});

/* ---------- 路由 ---------- */

app.use('/api', apiRouter);

// 同一服务同时提供前端页面，启动后直接访问 http://localhost:3000。
app.use(express.static(FRONTEND_DIR));
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// API 根路径保留端点索引，便于程序化调用方发现接口。
app.get('/api', (req, res) => {
  res.json({
    name: 'GitHub Trending API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      search: 'GET /api/search?keyword=...&days=7',
      repoDetail: 'GET /api/repos/:owner/:repo',
      readme: 'GET /api/repos/:owner/:repo/readme',
    },
  });
});

// 404 兜底（必须在路由之后）
app.use(notFoundHandler);

// 统一错误处理（必须在最后）
app.use(errorHandler);

/* ---------- 启动服务 ---------- */

const server = app.listen(PORT, () => {
  const tokenStatus = process.env.GITHUB_TOKEN ? '已配置（脱敏）' : '未配置（匿名模式，限流较严）';
  console.log('='.repeat(60));
  console.log(`GitHub 趋势搜索后端已启动`);
  console.log(`  监听端口：${PORT}`);
  console.log(`  访问地址：http://localhost:${PORT}`);
  console.log(`  健康检查：http://localhost:${PORT}/api/health`);
  console.log(`  GitHub Token：${tokenStatus}`);
  console.log('='.repeat(60));
});

// 优雅关闭
function gracefulShutdown(signal) {
  console.log(`\n收到 ${signal} 信号，正在关闭服务...`);
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
  // 10 秒后强制退出
  setTimeout(() => {
    console.error('强制退出');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
