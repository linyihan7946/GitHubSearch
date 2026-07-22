# GitHubSearch - GitHub 趋势搜索工具
# Node.js 20 Alpine
FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY backend/package*.json ./backend/

# 安装生产依赖
RUN cd backend && npm ci --production=false && npm cache clean --force

# 复制源码
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# 安全：非 root 运行
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -G appgroup -u 1001 && \
    chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
