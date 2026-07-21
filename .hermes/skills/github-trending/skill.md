# github-trending

> Search GitHub trending repos. Returns top 10 by stars in any domain/time window.

## API

Base: `http://localhost:3000`

### Search

```bash
GET /api/search?keyword=ai&days=30
```

`keyword` optional (empty = all repos). `days` defaults to 7.

### Repo detail

```bash
GET /api/repos/microsoft/typescript
```

### README

```bash
GET /api/repos/microsoft/typescript/readme
```

### Health

```bash
GET /api/health
```

## Response format

Success: `{"success":true,"data":{"items":[...]}}`
Error: `{"success":false,"error":{"code":"...","message":"..."}}`

## Error codes

- `VALIDATION_ERROR` (400)
- `NOT_FOUND` (404)
- `RATE_LIMITED` (429) — wait `retryAfter` seconds
- `GITHUB_ERROR` (502)

## Start

```bash
cd backend && npm start
```

Full spec: `openapi.yaml`
