---
name: github-trending
description: Search GitHub for the fastest-growing repos by stars in any domain and time period. Use when the user wants to discover trending open-source projects, find popular new repos, or research what's hot on GitHub.
metadata:
  trigger: 搜索 GitHub 趋势项目 / 发现热门开源项目 / 查找增长最快的仓库
  requires: 本地需启动后端 (cd backend && npm start)
---

# GitHub 趋势搜索

搜索 GitHub 上某领域在指定时间段内星标增长最快的开源项目，
返回 Top 10 排名列表，含星数、简介、语言、README 等。

## 前置条件

后端必须已启动，否则前端会回退到 GitHub 直连（限流 10 次/分钟）。

```bash
cd backend && npm start   # 默认 http://localhost:3000
```

验证服务在线：
```bash
curl -s http://localhost:3000/api/health
# {"status":"ok","timestamp":"...","uptime":123,"cache":{"size":0}}
```

## API 调用

### 搜索趋势项目（核心）

```
GET /api/search?keyword={关键词}&days={天数}
```

- `keyword`：可选，留空 = 全站热榜
- `days`：1-1825，默认 7

```bash
# AI 领域最近 30 天
curl -s "http://localhost:3000/api/search?keyword=ai&days=30"

# 全站最近一周热榜
curl -s "http://localhost:3000/api/search?days=7"
```

响应格式：
```json
{
  "success": true,
  "data": {
    "keyword": "ai",
    "days": 30,
    "totalCount": 482091,
    "items": [
      {
        "rank": 1,
        "name": "T3MP3ST",
        "fullName": "elder-plinius/T3MP3ST",
        "owner": "elder-plinius",
        "description": "autonomous red teaming platform",
        "stars": 5052,
        "language": "TypeScript",
        "languageColor": "#3178c6",
        "url": "https://github.com/elder-plinius/T3MP3ST",
        "topics": ["ai", "agents"],
        "license": "AGPL-3.0"
      }
    ]
  }
}
```

### 仓库详情

```
GET /api/repos/{owner}/{repo}
```

```bash
curl -s http://localhost:3000/api/repos/microsoft/typescript
```

### 获取 README

```
GET /api/repos/{owner}/{repo}/readme
```

```bash
curl -s http://localhost:3000/api/repos/microsoft/typescript/readme
```

## 错误处理

所有错误统一格式 `{ success: false, error: { code, message } }`：

| code | 含义 | 处理方式 |
|------|------|----------|
| `VALIDATION_ERROR` | 参数错误 | 检查 keyword/days |
| `NOT_FOUND` | 仓库不存在 | 跳过或提示用户 |
| `RATE_LIMITED` | GitHub 限流 | 等待 retryAfter 秒后重试 |
| `GITHUB_ERROR` | GitHub API 异常 | 稍后重试 |

## 使用建议

1. 先调 `/api/health` 确认服务在线
2. 搜索后按 `stars` 排序展示给用户
3. 如需深入，用 `/api/repos/{owner}/{repo}` 获取详情
4. 429 错误时等待 `retryAfter` 秒后重试
5. 对同一查询结果缓存 5 分钟（服务端已有缓存）
