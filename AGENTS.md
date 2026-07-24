# GitHub 趋势搜索 - AI Agent 指南

## ⚠️ 项目规则（Agent 必读）

### 目录规范

```
GitHubSearch/
├── frontend/       # 前端代码（HTML/CSS/JS）
├── backend/        # 后端代码（待开发）
└── AGENTS.md       # 项目文档（本文件）
```

**严格要求**：
- 前端文件（`.html`、`.css`、`.js`）必须放在 `frontend/` 目录
- 后端代码必须放在 `backend/` 目录
- 不得在项目根目录放置业务代码文件

### 文档管理

#### 大小限制与拆分

- **AGENTS.md 不得超过 500 行**
- 超过 500 行时，按模块拆分为子文档：
  - `docs/api.md` - API 相关文档
  - `docs/architecture.md` - 架构设计详情
  - `docs/coding-standards.md` - 编码规范详情
  - `docs/error-log.md` - 错误记录（独立文档）
- AGENTS.md 中仅保留**模块导航链接**

#### 文档更新时机

**必须更新 AGENTS.md 的场景**：
1. ✅ 新增功能后
2. ✅ 修改现有功能后
3. ✅ 调整目录结构后
4. ✅ 发现并修复重复错误后
5. ✅ 技术栈变更时

**更新检查清单**：
- [ ] 文件结构是否变化？
- [ ] 新增的 API 端点是否记录？
- [ ] 编码规范是否需要补充？
- [ ] 已知限制是否更新？
- [ ] 未来扩展列表是否需要同步？

### 重复错误记录

**规则**：如果同一个错误被修复 **2 次或以上**，必须记录到 `docs/error-log.md`。

**记录格式**：
```markdown
### [错误标题]
- **发生次数**：N 次
- **首次日期**：YYYY-MM-DD
- **最近日期**：YYYY-MM-DD
- **错误描述**：简要说明错误现象
- **根本原因**：为什么会重复出现
- **解决方案**：如何彻底避免
- **相关文件**：涉及的文件路径
```

**目的**：避免 Agent 重复犯同样的错误，提高开发效率。

---

## 📑 文档索引

> 当前文档 315 行（上限 500 行）。如需拆分，将对应章节移至 `docs/` 下的子文档。

| 模块 | 说明 | 位置 |
|------|------|------|
| ⚠️ 项目规则 | 目录规范、文档管理、错误记录 | 本文 §1 |
| 项目概述 | 核心功能介绍 | 本文 §2 |
| 技术栈 | 前后端技术选型 | 本文 §3 |
| 文件结构 | 目录组织 | 本文 §4 |
| 架构设计 | 单页应用、API 集成、响应式 | 本文 §5 |
| 后端 API 文档 | 4 个 REST 端点详细说明 | 本文 §6 |
| 编码规范 | JS / CSS / HTML 规范 | 本文 §7 |
| 关键实现细节 | 时间计算、限流、README 渲染 | 本文 §8 |
| 运行与测试 | 启动方式、测试要点 | 本文 §9 |
| 已知限制 | 当前局限性 | 本文 §10 |
| 未来扩展 | 短期优化 + 长期规划 | 本文 §11 |
| 调试技巧 | 常见问题排查 | 本文 §12 |
| 贡献指南 | 代码风格、提交规范、分支策略 | 本文 §13 |
| 相关资源 | 外部链接 | 本文 §14 |
| 📄 重复错误记录 | 被修复 ≥2 次的错误 | [`docs/error-log.md`](docs/error-log.md) |

---

## 项目概述

这是一个 GitHub 趋势搜索工具，用于发现某领域在特定时间段内星标增长最快的开源项目。
- **前端**：浏览器端界面，供用户可视化交互
- **后端**：Node.js REST API，供 Hermes 等 AI Agent 程序化调用

**核心功能**：
- 输入领域关键词（如 ai、rust、web）
- 选择时间范围（3天/一周/一月/一年/三年/五年）
- 展示该时间段内⭐增长最快的前10个项目
- 点击项目卡片查看详细信息和 README

## 技术栈

### 前端
- **原生**：HTML5 + CSS3 + JavaScript (ES6+)，无框架、无构建工具
- **样式**：自定义 CSS，支持亮色/暗色主题，响应式设计

### 后端
- **运行时**：Node.js（要求 ≥ 18，推荐 22+ 以使用原生 `fetch`）
- **框架**：Express 4.x
- **依赖**：`express`、`cors`、`dotenv`（最小化）
- **HTTP 客户端**：Node 18+ 原生 `fetch`（无需额外库）
- **缓存**：内存 Map + TTL（无 Redis 等外部依赖）
- **数据源**：GitHub REST API v3（Search API）

## 文件结构

```
GitHubSearch/
├── frontend/                         # 前端代码
│   ├── index.html                   # 主页面结构和语义化标签
│   ├── style.css                    # 样式表（包含响应式断点和主题变量）
│   └── app.js                       # 业务逻辑（API 调用、DOM 操作）
├── backend/                          # 后端代码（Node.js + Express）
│   ├── package.json                 # 依赖声明 + 启动脚本
│   ├── package-lock.json            # 依赖锁定
│   ├── .env.example                 # 环境变量模板（PORT, GITHUB_TOKEN）
│   ├── .gitignore                   # 忽略 node_modules, .env
│   ├── server.js                    # 入口：Express 实例化 + 中间件 + 启动
│   ├── routes/
│   │   └── api.js                   # 4 个 API 路由定义
│   ├── services/
│   │   └── github.js                # GitHub API 封装 + 内存缓存 + 语言颜色映射
│   ├── middleware/
│   │   └── errorHandler.js          # 统一错误处理 + 错误码常量
│   └── deploy/
│       ├── githubsearch-uppercase.conf  # 生产环境大写路径兼容跳转
│       └── install-gateway-alias.sh     # 安装并重载项目专属网关别名
├── docs/                             # 补充文档（按需拆分）
│   └── error-log.md                 # 重复错误记录（≥2 次的错误）
└── AGENTS.md                         # 项目主文档（本文件，≤500行）
```

## 架构设计

### 单页应用模式

这是一个**无路由的单页应用**，所有交互通过 JavaScript 动态更新 DOM：
- 搜索表单提交 → 调用 GitHub API → 渲染结果列表
- 点击项目卡片 → 弹窗显示详情 + 异步加载 README
- 后端同时托管 `frontend/` 静态文件，启动后统一通过 `http://localhost:3000` 访问网页和 API

### 关键模块

#### 1. 搜索流程 (`handleSearch`)
```
用户输入 → 计算起始日期 → 构造查询 → 调用 API → 渲染结果
```

#### 2. GitHub API 集成
- **端点**：`GET https://api.github.com/search/repositories`
- **查询参数**：
  - `q={keyword} created:>={date}`：按创建时间筛选
  - `sort=stars`：按星标数排序
  - `order=desc`：降序
  - `per_page=10`：返回前10个
- **README 获取**：`GET /repos/{owner}/{repo}/readme`（Accept: `application/vnd.github.html+json`）

#### 3. 响应式设计
- **PC 端**：卡片网格布局，弹窗居中
- **移动端**（≤640px）：垂直堆叠，弹窗从底部滑入
- **断点**：`640px`（主要）、`380px`（时间范围按钮）

## 后端 API 文档

后端提供 4 个 RESTful 端点，供 Hermes 等 Agent 调用。所有响应遵循统一格式：
- 成功：`{ "success": true, "data": {...} }`
- 失败：`{ "success": false, "error": { "code": "...", "message": "..." } }`

响应头 `x-cache: HIT/MISS` 标识是否命中缓存。

### 1. `GET /api/health` — 健康检查

无需参数，用于探活。

```bash
curl http://localhost:3000/api/health
# { "status": "ok", "timestamp": "...", "uptime": 123.4, "cache": { "size": 5 } }
```

### 2. `GET /api/search` — 搜索趋势项目（核心）

**参数**：
- `keyword` (可选，≤100 字符，留空表示全站搜索) — 领域关键词
- `days` (可选，默认 7，范围 1-1825) — 时间范围

```bash
curl "http://localhost:3000/api/search?keyword=ai&days=30"
```

**响应**：`data.items` 数组包含前 10 个项目，按⭐降序，每项含 `rank`、`name`、`fullName`、`owner`、`description`、`stars`、`forks`、`watchers`、`language`、`languageColor`、`url`、`createdAt`、`updatedAt`、`topics`、`license`、`openIssues`、`isArchived`。

### 3. `GET /api/repos/:owner/:repo` — 仓库详情

返回仓库完整信息 + 最近 5 次提交 + 最近 5 个 issues。

```bash
curl http://localhost:3000/api/repos/microsoft/typescript
```

### 4. `GET /api/repos/:owner/:repo/readme` — 获取 README

**参数**：`ref` (可选) — 分支名

```bash
curl http://localhost:3000/api/repos/microsoft/typescript/readme
# { "success": true, "data": { "html": "<rendered>", "hasReadme": true } }
```

### 错误码

| code | 含义 | HTTP 状态 |
|------|------|----------|
| `VALIDATION_ERROR` | 参数错误 | 400 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `RATE_LIMITED` | GitHub 限流（附带 `retryAfter` 秒数） | 429 |
| `GITHUB_ERROR` | GitHub API 异常 | 502 |
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |

### 缓存策略（内存 Map + TTL）

| 端点 | TTL | 说明 |
|------|-----|------|
| `/search` | 5 分钟 | 热度数据变化快 |
| `/repos/:o/:r` | 10 分钟 | 仓库信息相对稳定 |
| `/readme` | 30 分钟 | README 变化不频繁 |

缓存上限 200 项，超出后 FIFO 淘汰最早 50 项。

### GitHub Token 支持

在 `backend/.env` 中配置 `GITHUB_TOKEN` 可显著提升限流（10→30 次/分钟）。Token 仅需 `public_repo` 读取权限。

## 编码规范

### JavaScript

- **严格模式**：所有代码包裹在 IIFE 中，使用 `'use strict'`
- **DOM 缓存**：页面加载时一次性缓存所有 DOM 引用（`els` 对象）
- **事件委托**：列表项点击事件绑定在父容器上（未来优化）
- **异步处理**：使用 `async/await` + `try/catch` 处理 API 调用
- **错误处理**：区分 HTTP 状态码（403 限流、422 参数错误等）
- **XSS 防护**：所有用户输入和 API 返回数据通过 `escapeHtml` 转义

### CSS

- **CSS 变量**：使用 `:root` 定义主题色、间距、阴影等
- **暗色模式**：通过 `@media (prefers-color-scheme: dark)` 自动切换
- **BEM 命名**：避免，使用语义化类名（如 `.repo-card`、`.modal-title`）
- **响应式**：移动优先，使用 `max-width` 媒体查询
- **动画**：使用 `@keyframes` 和 `transition`，避免 JS 动画

### HTML

- **语义化标签**：`<header>`、`<main>`、`<section>`、`<footer>`
- **无障碍**：使用 `aria-label`、`role`、`tabindex` 提升可访问性
- **表单验证**：`required` 属性 + JS 二次验证

## 关键实现细节

### 1. 时间范围计算

```javascript
function calcSinceDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  // 格式化为 YYYY-MM-DD
  return `${y}-${m}-${day}`;
}
```

### 2. GitHub API 限流

- **未认证**：10 次请求/分钟
- **已认证**：30 次请求/分钟
- **错误码 403**：提示用户稍后重试
- **优化建议**：添加本地缓存（localStorage）或后端代理

### 3. README 渲染

- GitHub API 返回**已渲染的 HTML**（Accept: `application/vnd.github.html+json`）
- 直接插入 `innerHTML`（已通过 GitHub 过滤，但仍需注意 XSS）
- 样式通过 `.modal-readme` 类统一控制

### 4. 语言颜色映射

```javascript
const LANG_COLORS = {
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  // ... 从 GitHub Linguist 官方色值提取
};
```

用于在结果中显示编程语言的颜色圆点。

### 5. 简介自动翻译

- 搜索结果中的项目简介如果是**非中文**（不含 CJK 字符），前端会自动调用 Google Translate API 翻译为中文显示
- 使用 `hasChinese()` 正则 `/[一-鿿]/` 检测文本是否已含中文
- 翻译调用 Google Translate 免费 API：`translate.googleapis.com/translate_a/single`
- 翻译结果通过 `Map` 缓存，避免重复请求同一文本
- **异步非阻塞**：页面立即显示原文，翻译完成后原地替换
- 翻译后的描述带有 `is-translated` CSS 类，显示 "已翻译" 标记

## 运行与测试

### 前端

```bash
# 方式1：通过后端统一启动（推荐，可使用缓存并避免浏览器直连 GitHub 失败）
cd E:/GitHubWorkSpace/GitHubSearch/backend
npm start
# 浏览器访问 http://localhost:3000

# 方式2：仅启动前端静态服务器（仍需另行启动后端）
cd E:/GitHubWorkSpace/GitHubSearch/frontend
python -m http.server 8080
# 访问 http://localhost:8080
```

### 后端

```bash
# 1. 进入后端目录
cd E:/GitHubWorkSpace/GitHubSearch/backend

# 2. （可选）配置 GitHub Token 提升限流
cp .env.example .env
# 编辑 .env，填入 GITHUB_TOKEN

# 3. 安装依赖（首次运行）
npm install

# 4. 启动服务
npm start                 # 生产启动
npm run dev               # 开发模式（Node 22+ --watch 自动重载）
# 默认监听 http://localhost:3000

# 5. 测试接口
curl http://localhost:3000/api/health
curl "http://localhost:3000/api/search?keyword=ai&days=30"
curl http://localhost:3000/api/repos/microsoft/typescript
curl http://localhost:3000/api/repos/microsoft/typescript/readme
```

### Node.js 版本要求

- **最低**：18.x（原生 `fetch`）
- **推荐**：22.x（最新稳定版）
- **切换方式**（Windows nvm）：`nvm use 22.16.0`

### Codex 技能集成

- 个人技能：`C:\Users\Administrator\.codex\skills\search-github-trends`
- 调用方式：在请求中使用 `$search-github-trends`
- 技能通过包装脚本调用本项目 API；服务未启动时会自动检查 Node.js 版本并启动后端

### 生产路径兼容

- 一键部署生成的规范地址：`https://www.aigenimage.cn/githubsearch/`
- 项目专属兼容地址：`https://www.aigenimage.cn/GitHubSearch/`
- 兼容地址通过 `backend/deploy/githubsearch-uppercase.conf` 永久重定向到规范地址，不修改通用一键部署工具
- 首次安装或更新别名后，在远程项目目录执行 `sh backend/deploy/install-gateway-alias.sh`

### 测试要点

1. **前端功能测试**：
   - 修改 `frontend/app.js` 后先运行 `node --check frontend/app.js`，避免函数边界缺失导致整页脚本无法加载
   - 输入关键词（如 "ai"）+ 选择时间范围 → 验证结果列表
   - 点击项目卡片 → 验证弹窗显示详情和 README
   - 测试边界情况（无结果、API 限流、网络错误）

2. **后端 API 测试**：
   - 缺少必填参数（如 keyword）→ 返回 400 + `VALIDATION_ERROR`
   - 查询不存在的仓库 → 返回 404 + `NOT_FOUND`
   - 连续请求同一接口 → 第二次响应头 `x-cache: HIT`（缓存命中）
   - GitHub 限流 → 返回 429 + `RATE_LIMITED` + `retryAfter`

3. **响应式测试**：
   - PC 端（1920x1080）：卡片网格、弹窗居中
   - 移动端（375x667）：垂直堆叠、弹窗底部滑入

4. **无障碍测试**：
   - 键盘导航（Tab 切换、Enter/Space 打开弹窗、Esc 关闭）
   - 屏幕阅读器（检查 `aria-label` 和 `role`）

## 已知限制

1. **GitHub API 限流**：未认证 10 次/分钟，认证后 30 次/分钟（Search API）；已通过后端缓存缓解
2. **内存缓存**：后端使用进程内存缓存，重启即失效；高并发场景建议替换为 Redis
3. **无历史记录**：刷新页面后前端搜索状态丢失（未来可加 localStorage）
4. **无国际化**：当前仅支持中文，硬编码文本
5. **单进程部署**：后端未做 PM2 / cluster 配置，仅适合开发/演示环境

## 未来扩展

### 已完成

- [x] 后端 REST API（Node.js + Express）
- [x] 内存缓存层（5/10/30 分钟 TTL）
- [x] 统一错误处理 + 错误码体系
- [x] 可选 GitHub Token 支持
- [x] CORS 跨域支持

### 短期优化

- [ ] 前端改用后端 API 替代直连 GitHub（彻底解决浏览器限流）
- [ ] 前端添加 localStorage 缓存搜索历史
- [ ] 支持导出结果为 CSV/JSON
- [ ] 后端接入 Redis 替代内存缓存
- [ ] 后端添加 PM2 / cluster 部署脚本
- [ ] 后端添加接口请求频率限制（rate-limiter）
- [ ] 添加 GitHub Token 前端输入框（用户自填）

### 长期规划

- [ ] 接入更多数据源（GitLab、Bitbucket）
- [ ] 用户收藏/订阅功能
- [ ] 趋势可视化图表（stars 增长曲线）
- [ ] 国际化支持（i18n）

## 调试技巧

### 浏览器开发者工具

1. **Console**：查看 API 请求错误、DOM 更新日志
2. **Network**：检查 GitHub API 请求状态、响应时间
3. **Elements**：检查弹窗 DOM 结构、CSS 样式

### 常见问题

- **API 返回 403**：等待 1 分钟后重试（GitHub 限流）
- **README 加载失败**：某些项目没有 README 或 API 超时
- **样式错乱**：清除浏览器缓存，强制刷新（Ctrl+Shift+R）

## 贡献指南

### 代码风格

- **JavaScript**：使用 ESLint（推荐 Airbnb 规范）
- **CSS**：使用 Stylelint（推荐 standard 规范）
- **HTML**：使用 Prettier 格式化

### 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构（不新增功能/修复 bug）
test: 测试相关
chore: 构建/工具链
```

### 分支策略

- `main`：生产分支，保持稳定
- `dev`：开发分支，集成新功能
- `feature/*`：功能分支
- `fix/*`：修复分支

## 相关资源

- [GitHub Search API 文档](https://docs.github.com/en/rest/search/search)
- [GitHub REST API 认证](https://docs.github.com/en/rest/authentication)
- [MDN Web Docs](https://developer.mozilla.org/zh-CN/)
- [Can I Use](https://caniuse.com/) - 浏览器兼容性检查

---

**最后更新**：2026-07-24
**维护者**：Codex
