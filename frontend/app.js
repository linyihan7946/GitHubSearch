/* ============================================================
 * GitHub 趋势搜索 - 主逻辑
 * 优先使用后端 API（缓存 + 免限流），后端不可用时回退到 GitHub 直连
 * ============================================================ */

(function () {
  'use strict';

  // API 地址：开发时使用独立后端，部署时使用相对路径（兼容路径网关代理）
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const API_BASE = (isLocal && window.location.port !== '3000')
    ? 'http://localhost:3000/api/'  // 前端独立开发模式：显式指定后端地址
    : 'api/';                       // 同源部署（含生产环境路径网关代理），使用相对路径

  const PER_PAGE = 10;
  const FETCH_TIMEOUT_MS = 15000;

  /* ----- 带超时的 fetch ----- */
  function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  // 常用语言的 GitHub 色值（GitHub  Linguist 官方色值）
  const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
    Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
    PHP: '#4F5D95', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
    Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', Shell: '#89e051',
    Lua: '#000080', Scala: '#c22d40', R: '#198CE7', Vue: '#41b883',
    Svelte: '#ff3e00', HTML: '#e34c26', CSS: '#563d7c', Jupyter: '#DA5B0B',
  };

  /* ----- DOM 缓存 ----- */
  const $ = (sel) => document.querySelector(sel);
  const els = {
    form: $('#searchForm'),
    keyword: $('#keyword'),
    selectedDays: $('#selectedDays'),
    searchBtn: $('#searchBtn'),
    resultsSection: $('#resultsSection'),
    resultsTitle: $('#resultsTitle'),
    resultsMeta: $('#resultsMeta'),
    resultsList: $('#resultsList'),
    stateEmpty: $('#stateEmpty'),
    stateLoading: $('#stateLoading'),
    stateError: $('#stateError'),
    errorMessage: $('#errorMessage'),
    retryBtn: $('#retryBtn'),
    modal: $('#modal'),
    modalOverlay: $('#modalOverlay'),
    modalClose: $('#modalClose'),
    modalTitle: $('#modalTitle'),
    modalDescription: $('#modalDescription'),
    modalStats: $('#modalStats'),
    modalTopics: $('#modalTopics'),
    modalReadme: $('#modalReadme'),
    modalRepoLink: $('#modalRepoLink'),
  };

  /* ----- 时间范围切换 ----- */
  const rangeBtns = document.querySelectorAll('.range-btn');
  rangeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      rangeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      els.selectedDays.value = btn.dataset.days;
    });
  });

  /* ----- 搜索提交 ----- */
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSearch();
  });

  els.retryBtn.addEventListener('click', () => {
    handleSearch();
  });

  /* ----- 弹窗事件 ----- */
  els.modalOverlay.addEventListener('click', closeModal);
  els.modalClose.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modal.hidden) closeModal();
  });

  /* ----- 主搜索流程 ----- */
  async function handleSearch() {
    const keyword = els.keyword.value.trim();
    const days = parseInt(els.selectedDays.value, 10) || 7;
    const sinceDate = calcSinceDate(days);

    setLoading(true);
    showState('loading');

    try {
      const data = await searchRepos(keyword, days);
      const sinceDate = data.sinceDate || calcSinceDate(days);
      renderResults({
        keyword,
        days,
        sinceDate,
        totalCount: data.totalCount ?? data.total_count ?? 0,
        items: data.items || [],
      });
      showState('results');
    } catch (err) {
      console.error('搜索失败：', err);
      showError(err);
      showState('error');
    } finally {
      setLoading(false);
    }
  }

  /* ----- 计算起始日期（YYYY-MM-DD） ----- */
  function calcSinceDate(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /* ----- 调用搜索 API（优先后端） ----- */
  async function searchRepos(keyword, days) {
    // 优先走后端（有缓存、不限流），后端不可用时直接调 GitHub
    const backendUrl = `${API_BASE}search?keyword=${encodeURIComponent(keyword)}&days=${days}`;
    try {
      const res = await fetchWithTimeout(backendUrl);
      if (res.ok) {
        const json = await res.json();
        if (json.success) return normalizeSearchData(json.data);
      }
      // 后端返回非 2xx 或 success:false，可能是未启动，回退
      console.warn('后端不可用（状态: ' + res.status + '），尝试直连 GitHub');
    } catch (_) {
      console.warn('后端不可用（网络错误），尝试直连 GitHub');
    }

    // 回退：直连 GitHub
    const since = calcSinceDate(days);
    const query = keyword ? `${keyword} created:>=${since}` : `created:>=${since}`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${PER_PAGE}`;
    const res = await fetchWithTimeout(url, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!res.ok) {
      const body = await safeJson(res);
      const msg = body && body.message ? body.message : `请求失败（${res.status}）`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    const raw = await res.json();
    // 统一为后端格式，方便 renderResults 消费
    return normalizeSearchData({
      keyword,
      days,
      sinceDate: since,
      totalCount: raw.total_count || 0,
      items: raw.items || [],
    });
  }

  /** 统一后端驼峰字段与 GitHub API 下划线字段，渲染层只处理一种格式。 */
  function normalizeSearchData(data = {}) {
    return {
      ...data,
      totalCount: data.totalCount ?? data.total_count ?? 0,
      items: (data.items || []).map((repo) => ({
        ...repo,
        full_name: repo.full_name || repo.fullName || '',
        owner: repo.owner || '',
        stargazers_count: repo.stargazers_count ?? repo.stars ?? 0,
        forks_count: repo.forks_count ?? repo.forks ?? 0,
        watchers_count: repo.watchers_count ?? repo.watchers ?? 0,
        html_url: repo.html_url || repo.url || '',
        created_at: repo.created_at || repo.createdAt || '',
        updated_at: repo.updated_at || repo.updatedAt || '',
        open_issues_count: repo.open_issues_count ?? repo.openIssues ?? 0,
        archived: repo.archived ?? repo.isArchived ?? false,
      })),
    };
  }

  async function safeJson(res) {
    try {
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  /* ----- 获取 README（优先后端） ----- */
  async function fetchReadme(repo) {
    const fn = repo.full_name || (repo.owner ? ownerStr(repo.owner) + '/' + repo.name : repo.name);
    // 尝试后端
    try {
      const res = await fetchWithTimeout(`${API_BASE}repos/${fn}/readme`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data.html) return json.data.html;
      }
    } catch (_) { /* ignore */ }
    // 回退：直连 GitHub
    const res = await fetchWithTimeout(`https://api.github.com/repos/${fn}/readme`, {
      headers: { Accept: 'application/vnd.github.html+json' },
    });
    if (!res.ok) return null;
    return res.text();
  }

  /** 从 repo 取 owner 名（兼容对象和字符串） */
  function ownerStr(o) {
    return typeof o === 'string' ? o : (o && o.login || '');
  }

  /* ----- 渲染结果列表 ----- */
  function renderResults(ctx) {
    els.resultsList.innerHTML = '';

    const label = ctx.keyword ? `"${ctx.keyword}"` : 'GitHub 全站';

    if (!ctx.items.length) {
      els.resultsTitle.textContent = `未找到 ${label} 相关项目`;
      els.resultsMeta.textContent = `自 ${ctx.sinceDate} 起`;
      els.resultsSection.hidden = true;
      showState('empty');
      return;
    }

    els.resultsTitle.textContent = `TOP ${ctx.items.length} · ${label}`;
    const timeLabel = formatTimeRange(ctx.days);
    els.resultsMeta.textContent = `自 ${ctx.sinceDate} 起（${timeLabel}） · 共 ${formatNumber(ctx.totalCount)} 个项目`;

    ctx.items.forEach((repo, idx) => {
      const li = document.createElement('li');
      li.className = 'repo-card';
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label', `查看 ${repo.full_name} 详情`);

      const langColor = LANG_COLORS[repo.language] || '#8b949e';
      const stars = formatNumber(repo.stargazers_count);
      const forks = formatNumber(repo.forks_count);
      const owner = typeof repo.owner === 'string' ? repo.owner : (repo.owner && repo.owner.login || '');
      const name = repo.name;
      const desc = repo.description || '暂无简介';
      const createdAt = repo.created_at ? repo.created_at.slice(0, 10) : '';

      li.innerHTML = `
        <div class="repo-rank" aria-hidden="true">${idx + 1}</div>
        <div class="repo-body">
          <div class="repo-name">
            <span class="owner">${escapeHtml(owner)}</span>
            <span class="separator">/</span>
            <span>${escapeHtml(name)}</span>
          </div>
          <p class="repo-desc" data-original="${escapeHtml(desc)}">${escapeHtml(desc)}</p>
          <div class="repo-meta">
            <span class="meta-item" title="星标数">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
              <strong>${stars}</strong>
            </span>
            <span class="meta-item" title="Fork 数">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path fill="currentColor" d="M12 2a3 3 0 0 0-3 3c0 1.3.84 2.4 2 2.82V9H9a4 4 0 0 0-4 4v1h10v-1a4 4 0 0 0-4-4h-2V7.82A3.005 3.005 0 0 0 12 2zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm6 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
              </svg>
              ${forks}
            </span>
            ${repo.language ? `<span class="meta-item"><span class="language-dot" style="background:${langColor}"></span>${escapeHtml(repo.language)}</span>` : ''}
            ${createdAt ? `<span class="meta-item">创建于 ${createdAt}</span>` : ''}
          </div>
        </div>
      `;

      const openRepo = () => openModal(repo);
      li.addEventListener('click', openRepo);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openRepo();
        }
      });
      els.resultsList.appendChild(li);
    });

    els.resultsSection.hidden = false;

    // 异步翻译非中文简介
    const descEls = els.resultsList.querySelectorAll('.repo-desc');
    descEls.forEach((el) => {
      const original = el.getAttribute('data-original');
      if (original && !hasChinese(original)) {
        translateText(original).then((cn) => {
          if (cn && cn !== original) {
            el.textContent = cn;
            el.classList.add('is-translated');
          }
        });
      }
    });
  }

  /* ----- 打开详情弹窗 ----- */
  async function openModal(repo) {
    const owner = typeof repo.owner === 'string' ? repo.owner : (repo.owner && repo.owner.login || '');
    els.modalTitle.innerHTML = `<span style="color:var(--text-muted)">${escapeHtml(owner)} /</span> ${escapeHtml(repo.name)}`;
    const rawDesc = repo.description || '该项目暂无描述';
    els.modalDescription.textContent = rawDesc;

    // 异步翻译弹窗简介
    if (!hasChinese(rawDesc)) {
      translateText(rawDesc).then((cn) => {
        if (cn && cn !== rawDesc) {
          els.modalDescription.textContent = cn;
          els.modalDescription.classList.add('is-translated');
        }
      });
    }

    // 统计
    const stars = formatNumber(repo.stargazers_count);
    const forks = formatNumber(repo.forks_count);
    const watchers = formatNumber(repo.watchers_count || 0);
    const langColor = LANG_COLORS[repo.language] || '#8b949e';
    els.modalStats.innerHTML = `
      <span class="stat-chip star-chip" title="Stargazers">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        ${stars} 星
      </span>
      <span class="stat-chip" title="Forks">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2a3 3 0 0 0-3 3c0 1.3.84 2.4 2 2.82V9H9a4 4 0 0 0-4 4v1h10v-1a4 4 0 0 0-4-4h-2V7.82A3.005 3.005 0 0 0 12 2z"/></svg>
        ${forks} 分叉
      </span>
      <span class="stat-chip" title="Watchers">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
        ${watchers} 关注
      </span>
      ${repo.language ? `<span class="stat-chip"><span class="language-dot" style="background:${langColor}"></span>${escapeHtml(repo.language)}</span>` : ''}
      ${repo.license ? `<span class="stat-chip" title="License">${escapeHtml(repo.license.spdx_id || repo.license.name || 'License')}</span>` : ''}
    `;

    // 主题标签
    if (Array.isArray(repo.topics) && repo.topics.length) {
      els.modalTopics.innerHTML = repo.topics
        .slice(0, 10)
        .map((t) => `<span class="topic-tag">${escapeHtml(t)}</span>`)
        .join('');
    } else {
      els.modalTopics.innerHTML = '';
    }

    // README
    els.modalReadme.innerHTML = '<p class="readme-loading">正在加载 README…</p>';
    els.modalRepoLink.href = repo.html_url;

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const html = await fetchReadme(repo);
      if (els.modal.hidden) return; // 弹窗已关闭
      if (html) {
        els.modalReadme.innerHTML = html;
      } else {
        els.modalReadme.innerHTML = '<p style="color:var(--text-muted)">该项目暂无 README 文件</p>';
      }
    } catch (err) {
      console.warn('README 加载失败：', err);
      if (els.modal.hidden) return;
      els.modalReadme.innerHTML = '<p style="color:var(--danger)">README 加载失败，请稍后重试</p>';
    }
  }

  function closeModal() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
    // 清空内容，避免下次打开时闪烁旧数据
    setTimeout(() => {
      els.modalTitle.textContent = '';
      els.modalDescription.textContent = '';
      els.modalStats.innerHTML = '';
      els.modalTopics.innerHTML = '';
      els.modalReadme.innerHTML = '';
    }, 200);
  }

  /* ----- 状态切换 ----- */
  function showState(state) {
    els.stateEmpty.hidden = state !== 'empty';
    els.stateLoading.hidden = state !== 'loading';
    els.stateError.hidden = state !== 'error';
    if (state !== 'results') {
      els.resultsSection.hidden = true;
    }
  }

  function setLoading(loading) {
    els.searchBtn.disabled = loading;
    const label = loading ? '搜索中…' : '搜索';
    els.searchBtn.querySelector('span').textContent = label;
  }

  function showError(err) {
    let message = '请求失败，请稍后重试';
    if (err.status === 403) {
      message = 'GitHub API 请求次数已达上限（未登录限 10 次/分钟），请稍后再试';
    } else if (err.status === 422) {
      message = '查询格式无效，请检查关键词';
    } else if (err.status === 401 || err.status === 404) {
      message = 'GitHub API 返回错误，请稍后重试';
    } else if (err.message) {
      message = err.message;
    }
    els.errorMessage.textContent = message;
  }

  /* ----- 翻译（简介非中文时自动译成中文） ----- */
  const translationCache = new Map();
  const TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=';

  /** 判断文本是否已含中文 */
  function hasChinese(text) {
    if (!text) return false;
    return /[一-鿿㐀-䶿]/.test(text);
  }

  /** 调用 Google 翻译 API */
  async function translateText(text) {
    if (!text) return text;
    if (hasChinese(text)) return text;
    if (translationCache.has(text)) return translationCache.get(text);

    try {
      const url = TRANSLATE_API + encodeURIComponent(text);
      const res = await fetch(url);
      if (!res.ok) return text;
      const data = await res.json();
      // 解析 Google Translate 响应格式
      const translated = (data[0] || []).map((seg) => seg[0]).join('');
      translationCache.set(text, translated);
      return translated;
    } catch (err) {
      console.warn('翻译失败：', err);
      return text;
    }
  }

  /* ----- 工具函数 ----- */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function formatNumber(n) {
    if (n == null) return '0';
    n = Number(n);
    if (n >= 1000) {
      return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    }
    return String(n);
  }

  function formatTimeRange(days) {
    if (days <= 3) return '最近 3 天';
    if (days === 7) return '最近一周';
    if (days === 30) return '最近一月';
    if (days === 365) return '最近一年';
    if (days === 1095) return '最近三年';
    if (days === 1825) return '最近五年';
    return `最近 ${days} 天`;
  }

  /* ----- 初始化 ----- */
  els.keyword.focus();
})();
