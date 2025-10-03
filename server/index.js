const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const cron = require('node-cron');
const winston = require('winston');
const http = require('http');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const { authenticateAdmin } = require('./middleware/auth');
const { runBackgroundTasks } = require('./services/backgroundTasks');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const rustEngine = require('./utils/rustEngine');
const websocketService = require('./services/websocketService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5007;

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Create logs directory
const fs = require('fs');
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Import task routes
const taskRoutes = require('./routes/tasks');

// Initialize WebSocket service
websocketService.initialize(server);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/tasks', authenticateAdmin, taskRoutes);
app.use('/api/admin', authenticateAdmin, adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Background tasks - run every hour
cron.schedule('0 * * * *', () => {
  logger.info('Running background tasks...');
  runBackgroundTasks().catch(err => {
    logger.error('Background task failed:', err);
  });
});

// Start server
server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  
  // Wait for Rust engine to be ready
  try {
    const isReady = await rustEngine.waitForReady();
    if (isReady) {
      logger.info('Rust search engine is ready');
    } else {
      logger.warn('Rust search engine is not available - some features may not work');
    }
  } catch (error) {
    logger.error('Failed to initialize Rust search engine:', error);
  }
});

module.exports = app;
