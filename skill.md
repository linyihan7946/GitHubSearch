# GitHub Trending Search — Agent Skill

> 本文件是导航入口。各 Agent 平台的实际 skill 文件在对应目录下。

| Agent | 路径 | 说明 |
|-------|------|------|
| **Claude Code** | [`.claude/skills/github-trending/SKILL.md`](.claude/skills/github-trending/SKILL.md) | 带 frontmatter 元数据 |
| **Codex (OpenAI)** | [`.codex/skills/github-trending/skill.md`](.codex/skills/github-trending/skill.md) | 英文，面向通用 Agent |
| **Hermes** | [`.hermes/skills/github-trending/skill.md`](.hermes/skills/github-trending/skill.md) | 精简格式 |

> 完整 API 规范见 [`openapi.yaml`](./openapi.yaml)，可被任意 OpenAPI 客户端导入。

## 技能名称

`github-trending-search`

## 简介

搜索 GitHub 上某领域在指定时间段内星标增长最快的开源项目，
返回排名前 10 的项目详情（含星数、简介、语言、README 等）。

同时提供前端可视化页面（浏览器）和后端 REST API（Agent 调用）。

## 使用场景

- 发现 AI/Rust/Web 等领域的近期热门开源项目
- 了解某个时间段内 GitHub 上增长最快的项目
- 获取特定仓库的详细信息（含 README）
- 全站浏览 GitHub 最新热门项目

## 如何调用（优先选 API）

> **重要提示**：Agent 应优先使用 REST API（3000 端口），
> 避免直接调用 GitHub Search API（限流 10 次/分钟）。
> 本后端内置缓存（5 min），响应更快且不限流。

### 启动服务

```bash
# 1) 后端（必须）
cd backend
cp .env.example .env    # 可选：填入 GITHUB_TOKEN 提升限流
npm install
npm start               # 默认 http://localhost:3000

# 2) 前端（可选，供人类浏览）
cd frontend
python -m http.server 8080
```

### 端点速查

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 — 验证服务存活 + 缓存命中率 |
| `GET /api/search?keyword=...&days=...` | **核心** — 搜索趋势项目 |
| `GET /api/repos/{owner}/{repo}` | 仓库详情 + 最近提交/issues |
| `GET /api/repos/{owner}/{repo}/readme` | 渲染后的 README HTML |

完整定义见 [`openapi.yaml`](./openapi.yaml)，可用任意 OpenAPI 客户端导入。

## 示例

### 1) 搜索 trend

```bash
# AI 领域最近 30 天
curl -s "http://localhost:3000/api/search?keyword=ai&days=30"
```
```json
{
  "success": true,
  "data": {
    "keyword": "ai",
    "days": 30,
    "sinceDate": "2026-06-21",
    "totalCount": 482091,
    "items": [
      {
        "rank": 1,
        "name": "T3MP3ST",
        "fullName": "elder-plinius/T3MP3ST",
        "owner": "elder-plinius",
        "description": "autonomous red teaming platform...",
        "stars": 5052,
        "language": "TypeScript",
        "url": "https://github.com/elder-plinius/T3MP3ST",
        "topics": ["ai", "agents", "multi-agent"]
      }
    ]
  }
}
```

### 2) 全站热榜（不限领域）

```bash
curl -s "http://localhost:3000/api/search?days=7"
```

### 3) 仓库详情

```bash
curl -s "http://localhost:3000/api/repos/microsoft/typescript"
```

### 4) README

```bash
curl -s "http://localhost:3000/api/repos/microsoft/typescript/readme"
```

## 常见问题

### API 返回 429 (限流)

后端内置了内存缓存，但仍受 GitHub 原始限流约束。
解决方式：

- 在 `backend/.env` 填入 `GITHUB_TOKEN`（仅需 `public_repo` 权限）
- 限流从 10→30 次/分钟（Search API）
- 响应会附带 `retryAfter` 秒数

### 关键词为空

`keyword` 留空即为全站搜索，返回 GitHub 所有新仓库中星数最高的 10 个。

### 离线/未启动后端

前端会自动回退到直连 GitHub API（但有 10 次/分钟的限流风险）。

## 项目文件

```text
GitHubSearch/
├── openapi.yaml          ← OpenAPI 3.0 规范（机器可读）
├── skill.md              ← 本文件（Agent 使用说明）
├── AGENTS.md             ← 完整项目文档（编码、架构等）
├── frontend/             ← 浏览器端页面
├── backend/              ← REST API 服务
└── docs/
    └── error-log.md      ← 重复错误记录
```

## 对 AI Agent（Codex / Hermes）的要求

调用本 API 时：

1. 先检查 `GET /api/health` 确认服务在线
2. 使用 `/api/search` 获取趋势列表，按 `stars` 排序（已由服务端排序）
3. 若需深入某个项目，用 `/api/repos/{owner}/{repo}` 获取详情
4. 若需阅读 README，用 `/api/repos/{owner}/{repo}/readme` 获取 HTML
5. 出现 429 错误时等待 `retryAfter` 秒后重试
6. 所有错误遵循统一格式 `{ success: false, error: { code, message } }`

## 技术栈

- 前端：原生 HTML/CSS/JS + 响应式 + 亮暗主题
- 后端：Node.js 22 + Express 4 + 内存缓存
- API 格式：JSON（全驼峰命名）
- 数据源：GitHub REST API v3
