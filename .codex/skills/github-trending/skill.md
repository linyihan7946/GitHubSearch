# GitHub Trending Search

## Description

Search GitHub for the fastest-growing open-source repositories by stars
in any domain and time period. Returns Top 10 ranked results with stars,
description, language, and README.

## When to use

- User asks "what's trending on GitHub"
- User wants to discover popular new open-source projects
- User asks about repos in a specific domain (AI, Rust, Web, etc.)
- User wants to find the most-starred repos from the last N days

## Prerequisites

The backend server must be running:

```bash
cd backend && npm start
# API available at http://localhost:3000
```

## Endpoints

### Search (primary)

```
GET /api/search?keyword={keyword}&days={days}
```

| Parameter | Required | Default | Range |
|-----------|----------|---------|-------|
| `keyword` | No (empty = all) | — | ≤ 100 chars |
| `days` | No | 7 | 1–1825 |

Example:
```bash
curl -s "http://localhost:3000/api/search?keyword=ai&days=30"
```

Response:
```json
{
  "success": true,
  "data": {
    "keyword": "ai",
    "days": 30,
    "totalCount": 482091,
    "items": [{
      "rank": 1,
      "name": "T3MP3ST",
      "fullName": "elder-plinius/T3MP3ST",
      "owner": "elder-plinius",
      "description": "autonomous red teaming platform",
      "stars": 5052,
      "forks": 1038,
      "language": "TypeScript",
      "languageColor": "#3178c6",
      "url": "https://github.com/elder-plinius/T3MP3ST",
      "createdAt": "2026-07-02",
      "updatedAt": "2026-07-21",
      "topics": ["ai", "agents", "multi-agent"],
      "license": "AGPL-3.0",
      "openIssues": 1,
      "isArchived": false
    }]
  }
}
```

### Repo Detail

```
GET /api/repos/{owner}/{repo}
```

Returns full repo info + last 5 commits + last 5 issues.

### README

```
GET /api/repos/{owner}/{repo}/readme
```

Returns rendered README HTML.

### Health

```
GET /api/health
```

## Error Handling

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "GitHub API 请求次数已达上限，请稍后重试",
    "retryAfter": 60
  }
}
```

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Invalid parameter |
| `NOT_FOUND` | 404 | Repo not found |
| `RATE_LIMITED` | 429 | GitHub rate limit (wait `retryAfter` seconds) |
| `GITHUB_ERROR` | 502 | GitHub API error |

## Cache

Server-side in-memory cache:
- Search: 5 min TTL
- Repo detail: 10 min TTL
- README: 30 min TTL

Response header `x-cache: HIT/MISS` indicates cache status.

## Full API Spec

See [openapi.yaml](../../openapi.yaml) for the complete OpenAPI 3.0 specification.
