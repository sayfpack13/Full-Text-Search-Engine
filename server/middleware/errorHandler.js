const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Custom error classes
class SearchEngineError extends Error {
  constructor(message, code = 'SEARCH_ENGINE_ERROR', statusCode = 500) {
    super(message);
    this.name = 'SearchEngineError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.statusCode = 400;
    this.field = field;
  }
}

class ServerTaskError extends Error {
  constructor(message, taskId = null) {
    super(message);
    this.name = 'ServerTaskError';
    this.code = 'TASK_ERROR';
    this.taskId = taskId;
    this.statusCode = 400;
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    this.code = 'AUTH_ERROR';
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = 'AUTHZ_ERROR';
    this.statusCode = 403;
  }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Handle different error types
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        type: 'validation',
        code: err.code,
        message: err.message,
        field: err.field
      }
    });
  }

  if (err instanceof AuthenticationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        type: 'authentication',
        code: err.code,
        message: err.message
      }
    });
  }

  if (err instanceof AuthorizationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        type: 'authorization',
        code: err.code,
        message: err.message
      }
    });
  }

  if (err instanceof SearchEngineError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        type: 'search_engine',
        code: err.code,
        message: err.message
      }
    });
  }

  // Handle specific system errors
  if (err.code === 'ENOENT') {
    return res.status(503).json({
      success: false,
      error: {
        type: 'service_unavailable',
        code: 'RUST_BINARY_NOT_FOUND',
        message: 'Search engine service is not available. Please contact administrator.',
        details: 'The search engine binary is missing or not built properly.'
      }
    });
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      success: false,
      error: {
        type: 'service_unavailable',
        code: 'SERVICE_UNAVAILABLE',
        message: 'Search engine service is temporarily unavailable.',
        details: 'Please try again later or contact administrator.'
      }
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        type: 'authentication',
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token.'
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        type: 'authentication',
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired.'
      }
    });
  }

  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: {
        type: 'validation',
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds the maximum limit.',
        details: 'Maximum file size is 10MB.'
      }
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: {
        type: 'validation',
        code: 'INVALID_FILE_FIELD',
        message: 'Invalid file field name.',
        details: 'Expected field name: "document".'
      }
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      type: 'internal',
      code: 'INTERNAL_ERROR',
      message: message,
      ...(process.env.NODE_ENV === 'development' && { 
        details: err.message,
        stack: err.stack 
      })
    }
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      type: 'not_found',
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found.`
    }
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
  SearchEngineError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ServerTaskError
};
