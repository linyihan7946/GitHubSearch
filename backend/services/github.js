/* ============================================================
 * GitHub API 服务（含内存缓存）
 * ============================================================
 * 封装所有 GitHub API 调用，提供：
 *   1. 内存缓存（Map + TTL）降低请求频率
 *   2. 统一的错误转换
 *   3. 数据格式化（清洗 + 语言颜色映射）
 *   4. 可选的 GitHub Token 支持
 * ============================================================ */

const { createError, ERROR_CODES } = require('../middleware/errorHandler');

const API_BASE = 'https://api.github.com';
const DEFAULT_PER_PAGE = 10;

// 缓存 TTL（毫秒）
const CACHE_TTL = {
  search: 5 * 60 * 1000,       // 5 分钟 — 热度数据变化快
  repo: 10 * 60 * 1000,        // 10 分钟
  readme: 30 * 60 * 1000,      // 30 分钟
  commits: 5 * 60 * 1000,      // 5 分钟
  issues: 5 * 60 * 1000,       // 5 分钟
};

// 常用语言的 GitHub Linguist 官方色值
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
  PHP: '#4F5D95', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
  Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', Shell: '#89e051',
  Lua: '#000080', Scala: '#c22d40', R: '#198CE7', Vue: '#41b883',
  Svelte: '#ff3e00', HTML: '#e34c26', CSS: '#563d7c', Jupyter: '#DA5B0B',
  Elixir: '#6e4a7e', Haskell: '#5e5086', Clojure: '#db5855', Zig: '#ec915c',
};

/* ===== 内存缓存实现 ===== */

const cacheStore = new Map(); // key -> { value, expireAt }

function cacheGet(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlMs) {
  // 限制缓存大小，避免内存泄漏（超过 200 项清理最早的 50 项）
  if (cacheStore.size >= 200) {
    const keys = Array.from(cacheStore.keys());
    for (let i = 0; i < 50; i++) cacheStore.delete(keys[i]);
  }
  cacheStore.set(key, { value, expireAt: Date.now() + ttlMs });
}

function cacheStats() {
  return { size: cacheStore.size };
}

/* ===== GitHub API 请求 ===== */

function buildHeaders(extra = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'GitHub-Trending-Backend',
    ...extra,
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubFetch(url, options = {}) {
  const { accept, ...rest } = options;
  const headers = buildHeaders(accept ? { Accept: accept } : {});

  let res;
  try {
    res = await fetch(url, { headers, ...rest });
  } catch (err) {
    throw createError(`GitHub API 网络错误：${err.message}`, {
      status: 502,
      code: ERROR_CODES.GITHUB_ERROR,
    });
  }

  // 限流处理：GitHub 返回 403/429 时带 X-RateLimit-Reset

  // 限流处理：GitHub 返回 403/429 时带 X-RateLimit-Reset
  if (res.status === 403 || res.status === 429) {
    const resetAt = res.headers.get('X-RateLimit-Reset');
    const retryAfter = resetAt ? Math.max(1, Number(resetAt) - Math.floor(Date.now() / 1000)) : 60;
    throw createError('GitHub API 请求次数已达上限，请稍后重试', {
      status: 429,
      code: ERROR_CODES.RATE_LIMITED,
      retryAfter,
    });
  }

  // 仓库不存在
  if (res.status === 404) {
    throw createError('仓库不存在', { status: 404, code: ERROR_CODES.NOT_FOUND });
  }

  // 其他非 2xx
  if (!res.ok) {
    let message = `GitHub API 返回 ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.message) message = body.message;
    } catch (_) {
      // ignore parse error
    }
    throw createError(message, { status: 502, code: ERROR_CODES.GITHUB_ERROR });
  }

  return res;
}

/* ===== 日期工具 ===== */

function calcSinceDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ===== 数据格式化 ===== */

function formatRepo(raw, rank) {
  const owner = raw.owner && raw.owner.login ? raw.owner.login : '';
  return {
    rank,
    name: raw.name,
    fullName: raw.full_name,
    owner,
    description: raw.description || null,
    stars: raw.stargazers_count || 0,
    forks: raw.forks_count || 0,
    watchers: raw.watchers_count || 0,
    language: raw.language || null,
    languageColor: raw.language ? LANG_COLORS[raw.language] || null : null,
    url: raw.html_url,
    createdAt: raw.created_at ? raw.created_at.slice(0, 10) : null,
    updatedAt: raw.updated_at ? raw.updated_at.slice(0, 10) : null,
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    license: raw.license && raw.license.spdx_id && raw.license.spdx_id !== 'NOASSERTION'
      ? raw.license.spdx_id
      : null,
    openIssues: raw.open_issues_count || 0,
    isArchived: !!raw.archived,
  };
}

function formatRepoDetail(raw) {
  const base = formatRepo(raw, null);
  return {
    ...base,
    size: raw.size || 0,                   // KB
    defaultBranch: raw.default_branch,
    homepage: raw.homepage || null,
    hasWiki: !!raw.has_wiki,
    hasProjects: !!raw.has_projects,
    forks: raw.forks_count || 0,
    openIssues: raw.open_issues_count || 0,
    networkCount: raw.network_count || 0,
    subscribersCount: raw.subscribers_count || 0,
    pushedAt: raw.pushed_at ? raw.pushed_at.slice(0, 10) : null,
    isTemplate: !!raw.is_template,
    isFork: !!raw.fork,
  };
}

function formatCommit(raw) {
  return {
    sha: raw.sha ? raw.sha.slice(0, 7) : null,
    message: raw.commit && raw.commit.message ? raw.commit.message.split('\n')[0] : null,
    author: raw.commit && raw.commit.author ? raw.commit.author.name : null,
    date: raw.commit && raw.commit.author ? raw.commit.author.date : null,
    url: raw.html_url,
  };
}

function formatIssue(raw) {
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    author: raw.user && raw.user.login ? raw.user.login : null,
    createdAt: raw.created_at,
    url: raw.html_url,
    labels: Array.isArray(raw.labels) ? raw.labels.map((l) => l.name).filter(Boolean) : [],
  };
}

/* ===== 对外暴露的 API ===== */

/**
 * 搜索趋势项目
 * @returns {{ data: object, cacheHit: boolean }}
 */
async function searchRepos(keyword, days) {
  const cacheKey = `search:${keyword.toLowerCase()}:${days}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { data: cached, cacheHit: true };

  const sinceDate = calcSinceDate(days);
  const q = keyword
    ? `${keyword} created:>=${sinceDate}`
    : `created:>=${sinceDate}`;
  const url =
    `${API_BASE}/search/repositories` +
    `?q=${encodeURIComponent(q)}` +
    `&sort=stars&order=desc&per_page=${DEFAULT_PER_PAGE}`;

  const res = await githubFetch(url);
  const body = await res.json();

  const data = {
    keyword,
    days,
    sinceDate,
    totalCount: body.total_count || 0,
    items: Array.isArray(body.items)
      ? body.items.map((item, idx) => formatRepo(item, idx + 1))
      : [],
  };

  cacheSet(cacheKey, data, CACHE_TTL.search);
  return { data, cacheHit: false };
}

/**
 * 获取仓库详情（含最近提交 + 最近 issues）
 */
async function getRepoDetail(owner, repo) {
  const cacheKey = `repo:${owner}/${repo}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { data: cached, cacheHit: true };

  // 并行请求：仓库信息 + 最近 5 次提交 + 最近 5 个 issues
  const [repoRes, commitsRes, issuesRes] = await Promise.all([
    githubFetch(`${API_BASE}/repos/${owner}/${repo}`),
    githubFetch(`${API_BASE}/repos/${owner}/${repo}/commits?per_page=5`).catch(() => null),
    githubFetch(`${API_BASE}/repos/${owner}/${repo}/issues?per_page=5&state=all&sort=created&direction=desc`).catch(() => null),
  ]);

  const [repoBody, commitsBody, issuesBody] = await Promise.all([
    repoRes.json(),
    commitsRes ? commitsRes.json().catch(() => []) : Promise.resolve([]),
    issuesRes ? issuesRes.json().catch(() => []) : Promise.resolve([]),
  ]);

  const data = {
    ...formatRepoDetail(repoBody),
    recentCommits: Array.isArray(commitsBody) ? commitsBody.map(formatCommit) : [],
    recentIssues: Array.isArray(issuesBody) ? issuesBody.map(formatIssue) : [],
  };

  cacheSet(cacheKey, data, CACHE_TTL.repo);
  return { data, cacheHit: false };
}

/**
 * 获取 README（已渲染 HTML）
 */
async function getReadme(owner, repo, ref) {
  const cacheKey = `readme:${owner}/${repo}:${ref || 'default'}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { data: cached, cacheHit: true };

  let url = `${API_BASE}/repos/${owner}/${repo}/readme`;
  if (ref) url += `?ref=${encodeURIComponent(ref)}`;

  let res;
  try {
    res = await githubFetch(url, { accept: 'application/vnd.github.html+json' });
  } catch (err) {
    // README 不存在时 GitHub 返回 404，视为正常（非错误）
    if (err.code === ERROR_CODES.NOT_FOUND) {
      const data = { html: null, hasReadme: false };
      cacheSet(cacheKey, data, CACHE_TTL.readme);
      return { data, cacheHit: false };
    }
    throw err;
  }

  const html = await res.text();
  const data = { html, hasReadme: !!html };

  cacheSet(cacheKey, data, CACHE_TTL.readme);
  return { data, cacheHit: false };
}

module.exports = {
  searchRepos,
  getRepoDetail,
  getReadme,
  cacheStats,
  // 导出供单元测试使用
  _internal: { calcSinceDate, formatRepo, cacheStore },
};
