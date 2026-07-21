/* ============================================================
 * API 路由定义
 * ============================================================
 * 4 个端点：
 *   GET /api/health              - 健康检查
 *   GET /api/search              - 搜索趋势项目（核心）
 *   GET /api/repos/:owner/:repo  - 仓库详情
 *   GET /api/repos/:owner/:repo/readme - 获取 README
 * ============================================================ */

const express = require('express');
const github = require('../services/github');
const { createError, ERROR_CODES } = require('../middleware/errorHandler');

const router = express.Router();

// 允许的 days 范围
const DAYS_MIN = 1;
const DAYS_MAX = 1825; // 5 年
const DAYS_DEFAULT = 7;

/* ---------- GET /api/health ---------- */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: github.cacheStats(),
  });
});

/* ---------- GET /api/search ---------- */
router.get('/search', async (req, res, next) => {
  try {
    const keyword = (req.query.keyword || '').trim();

    // 限制关键词长度，防止滥用（允许空字符串表示全站搜索）
    if (keyword.length > 100) {
      throw createError('keyword 长度不得超过 100 字符', {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    let days = parseInt(req.query.days, 10);
    if (Number.isNaN(days)) days = DAYS_DEFAULT;
    if (days < DAYS_MIN || days > DAYS_MAX) {
      throw createError(`days 必须在 ${DAYS_MIN}-${DAYS_MAX} 之间`, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const result = await github.searchRepos(keyword, days);

    // 缓存命中时添加响应头
    if (result.cacheHit) res.setHeader('x-cache', 'HIT');
    else res.setHeader('x-cache', 'MISS');

    res.json({ success: true, data: result.data });
  } catch (err) {
    next(err);
  }
});

/* ---------- GET /api/repos/:owner/:repo ---------- */
router.get('/repos/:owner/:repo', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;

    // 基础参数校验
    if (!owner || !repo) {
      throw createError('owner 和 repo 不能为空', {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const result = await github.getRepoDetail(owner, repo);
    if (result.cacheHit) res.setHeader('x-cache', 'HIT');
    else res.setHeader('x-cache', 'MISS');

    res.json({ success: true, data: result.data });
  } catch (err) {
    next(err);
  }
});

/* ---------- GET /api/repos/:owner/:repo/readme ---------- */
router.get('/repos/:owner/:repo/readme', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const ref = req.query.ref ? String(req.query.ref).trim() : undefined;

    if (!owner || !repo) {
      throw createError('owner 和 repo 不能为空', {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const result = await github.getReadme(owner, repo, ref);
    if (result.cacheHit) res.setHeader('x-cache', 'HIT');
    else res.setHeader('x-cache', 'MISS');

    res.json({ success: true, data: result.data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
