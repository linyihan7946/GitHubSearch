/* ============================================================
 * 统一错误处理中间件
 * ============================================================
 * 所有路由抛出的错误都会被这里捕获，返回标准格式的 JSON 响应。
 *
 * 错误对象约定字段：
 *   - status    {number}  HTTP 状态码（默认 500）
 *   - code      {string}  业务错误码（默认 INTERNAL_ERROR）
 *   - message   {string}  可读错误信息
 *   - retryAfter {number} 可选，建议客户端重试秒数
 * ============================================================ */

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  GITHUB_ERROR: 'GITHUB_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/**
 * Express 错误处理中间件（4 参数签名）
 */
function errorHandler(err, req, res, _next) {
  const status = typeof err.status === 'number' ? err.status : 500;
  const code = err.code || ERROR_CODES.INTERNAL_ERROR;
  const message = err.message || '服务器内部错误';

  // 生产环境不暴露堆栈细节
  const response = {
    success: false,
    error: {
      code,
      message,
      ...(err.retryAfter != null && { retryAfter: err.retryAfter }),
    },
  };

  // 仅在非生产环境输出堆栈，便于调试
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.error.stack = err.stack;
  }

  // 记录错误日志（不打印 4xx 客户端错误的堆栈）
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} - ${code}: ${message}`);
    if (err.stack) console.error(err.stack);
  } else {
    console.warn(`[WARN] ${req.method} ${req.originalUrl} - ${code}: ${message}`);
  }

  res.status(status).json(response);
}

/**
 * 404 兜底：路径不存在
 */
function notFoundHandler(req, res, next) {
  const err = new Error(`路径不存在：${req.method} ${req.originalUrl}`);
  err.status = 404;
  err.code = ERROR_CODES.NOT_FOUND;
  next(err);
}

/**
 * 工厂：快速构造带状态码和错误码的错误对象
 */
function createError(message, { status = 500, code = ERROR_CODES.INTERNAL_ERROR, retryAfter } = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (retryAfter != null) err.retryAfter = retryAfter;
  return err;
}

module.exports = {
  errorHandler,
  notFoundHandler,
  createError,
  ERROR_CODES,
};
