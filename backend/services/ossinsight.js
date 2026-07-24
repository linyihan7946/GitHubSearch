/* ============================================================
 * OSS Insight API 客户端
 * ============================================================
 * 封装 OSS Insight Public API 调用，提供：
 *   1. 真实趋势排名（基于 6B+ GitHub 事件计算的 total_score）
 *   2. 星标历史数据（月度粒度的 stargazers 计数）
 *   3. 统一的错误处理与字段映射
 *
 * 文档：https://ossinsight.io/docs/api
 * 限流：600 次/小时/IP（公共 beta）
 * ============================================================ */

const OSS_BASE = 'https://api.ossinsight.io/v1';

/* ===== 时间段映射 ===== */

/**
 * 将前端 days 参数映射为 OSS Insight 的 period 值。
 * OSS Insight 支持的 period：
 *   past_24_hours / past_week / past_month / past_3_months
 *
 * 超过 3 个月的查询会被截断至 past_3_months。
 */
function daysToPeriod(days) {
  if (days <= 3) return 'past_24_hours';
  if (days <= 7) return 'past_week';
  if (days <= 30) return 'past_month';
  return 'past_3_months'; // 1 年 / 3 年 / 5 年统一截断
}

/**
 * 返回人类可读的 period 中文名称。
 */
function periodLabel(period) {
  const labels = {
    past_24_hours: '24 小时',
    past_week: '近一周',
    past_month: '近一月',
    past_3_months: '近三月',
  };
  return labels[period] || period;
}

/**
 * 返回 period 所覆盖的天数（用于前端展示）。
 */
function periodDays(period) {
  const dayMap = {
    past_24_hours: 1,
    past_week: 7,
    past_month: 30,
    past_3_months: 90,
  };
  return dayMap[period] || 90;
}

/* ===== 行映射 ===== */

/**
 * 将 OSS Insight 原始行转换为与现有代码兼容的驼峰格式。
 *
 * 输入示例：
 *   { repo_name: "owner/repo", stars: "58", total_score: "377.42", ... }
 *
 * 输出字段：
 *   name, fullName, owner, description, stars, forks, language,
 *   trendingScore, collections, url
 */
function mapRowToRepo(row) {
  const repoName = row.repo_name || '';
  const [owner, repo] = repoName.split('/', 2);
  const collections = (row.collection_names || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    name: repo || '',
    fullName: repoName,
    owner: owner || '',
    description: row.description || null,
    stars: parseInt(row.stars, 10) || 0,
    forks: parseInt(row.forks, 10) || 0,
    language: row.primary_language || null,
    trendingScore: parseFloat(row.total_score) || 0,
    collections,
    url: repoName ? `https://github.com/${repoName}` : '',
  };
}

/* ===== API 调用 ===== */

/**
 * 获取趋势仓库列表。
 * @param {string} period - past_24_hours / past_week / past_month / past_3_months
 * @returns {Promise<Array>} 已映射的仓库数组，失败时返回 []
 */
async function fetchTrendingRepos(period) {
  const url = `${OSS_BASE}/trends/repos?period=${encodeURIComponent(period)}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error(`OSS Insight API 网络错误（${period}）：${err.message}`);
    return [];
  }

  if (!res.ok) {
    console.error(`OSS Insight API 返回 ${res.status}（${period}）`);
    return [];
  }

  let body;
  try {
    body = await res.json();
  } catch (err) {
    console.error(`OSS Insight API JSON 解析失败（${period}）：${err.message}`);
    return [];
  }

  const rows = body.data && body.data.rows ? body.data.rows : [];
  return rows.map(mapRowToRepo);
}

/**
 * 获取仓库星标历史（月度数据）。
 * @returns {Promise<Array<{date: string, count: number}>>}
 */
async function fetchStarHistory(owner, repo) {
  const key = `${owner}/${repo}`;
  const url = `${OSS_BASE}/repos/${encodeURIComponent(key)}/stargazers/history`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = await res.json();
    const rows = body.data && body.data.rows ? body.data.rows : [];
    return rows.map((r) => ({
      date: r.date,
      count: parseInt(r.stargazers, 10) || 0,
    }));
  } catch (err) {
    console.error(`星标历史查询失败（${key}）：${err.message}`);
    return [];
  }
}

/* ===== 星标增长估算 ===== */

// 星标历史缓存（月度数据变化慢，TTL 1 小时）
const historyCache = new Map();

/**
 * 从月度星标历史估算指定时间段内的新增星数。
 *
 * OSS Insight 星标历史仅提供月度粒度数据：
 *   - past_24_hours / past_week：按最近一月增量等比例估算
 *   - past_month：最近一月减前一月
 *   - past_3_months：最近三月累加
 *
 * @returns {number|null} 估算新增星数，数据不足时返回 null
 */
function estimateGrowth(history, period) {
  if (!history || history.length < 2) return null;

  // 按日期升序排列
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const monthlyGrowth = Math.max(0, latest.count - prev.count);

  switch (period) {
    case 'past_24_hours':
      return Math.round(monthlyGrowth / 30);
    case 'past_week':
      return Math.round(monthlyGrowth / 4);
    case 'past_month':
      return monthlyGrowth;
    case 'past_3_months': {
      // 取最后 4 个数据点（覆盖约 3 个月）
      const window = sorted.slice(-4);
      if (window.length < 2) return monthlyGrowth;
      const growth = Math.max(0, latest.count - window[0].count);
      return growth;
    }
    default:
      return monthlyGrowth;
  }
}

/**
 * 为仓库列表并发生成星标增长估算。
 * 单个仓库获取失败时静默跳过（starGrowth 保持 null）。
 *
 * @param {Array} items - 仓库数组（含 fullName 字段）
 * @param {string} period - OSS Insight 时间段
 * @returns {Promise<Array>} 带 starGrowth 字段的仓库数组
 */
async function enrichWithStarGrowth(items, period) {
  const enriched = await Promise.all(
    items.map(async (item) => {
      const parts = (item.fullName || '').split('/');
      const owner = parts[0];
      const repo = parts[1];
      if (!owner || !repo) return item;

      // 检查缓存
      const cacheKey = `history:${item.fullName}`;
      const entry = historyCache.get(cacheKey);
      let history;
      if (entry && Date.now() < entry.expireAt) {
        history = entry.data;
      } else {
        history = await fetchStarHistory(owner, repo);
        historyCache.set(cacheKey, {
          data: history,
          expireAt: Date.now() + 60 * 60 * 1000, // 1 小时
        });
        // 限制缓存大小
        if (historyCache.size > 500) {
          const keys = Array.from(historyCache.keys());
          for (let i = 0; i < 50; i++) historyCache.delete(keys[i]);
        }
      }

      const starGrowth = estimateGrowth(history, period);
      return { ...item, starGrowth };
    })
  );

  return enriched;
}

module.exports = {
  daysToPeriod,
  periodLabel,
  periodDays,
  fetchTrendingRepos,
  fetchStarHistory,
  enrichWithStarGrowth,
  // 导出内部函数供测试
  _internal: { mapRowToRepo, estimateGrowth },
};
