# GitHub 趋势搜索

发现 GitHub 上某领域在某时间段内⭐增长最快的开源项目。

## 功能

- 输入领域关键词搜索（留空则为全站搜索）
- 选择时间范围：3天 / 一周 / 一月 / 一年 / 三年 / 五年
- TOP 10 星标增长最快的项目，按星数降序排列
- 点击项目卡片查看详情和 README
- 非中文简介自动翻译为中文
- 适配 PC 和移动端，支持亮色/暗色主题
- 提供 REST API 供 AI Agent（如 Hermes）调用

## 快速开始

### 前端

```bash
cd frontend
python -m http.server 8080
# 访问 http://localhost:8080
```

### 后端

```bash
cd backend
npm install
npm start
# API 运行在 http://localhost:3000
```

## API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/search?keyword=ai&days=7` | 搜索趋势项目 |
| `GET /api/repos/:owner/:repo` | 仓库详情 |
| `GET /api/repos/:owner/:repo/readme` | 获取 README |

## 技术栈

- **前端**：原生 HTML5 + CSS3 + JavaScript (ES6+)
- **后端**：Node.js + Express 4.x
- **数据源**：GitHub REST API v3

## 项目结构

```
GitHubSearch/
├── frontend/           # 前端页面
├── backend/            # Node.js REST API
├── docs/               # 补充文档
├── AGENTS.md           # AI Agent 指南
└── README.md
```

## License

MIT
