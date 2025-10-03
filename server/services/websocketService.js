const { Server } = require('socket.io');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map(); // Map of client socket IDs to task subscriptions
    this.roomClients = new Map(); // Map of task IDs to client sets for tracking who's watching which tasks
  }

  initialize(server, options = {}) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.CORS_ORIGIN || "http://localhost:3000"
          : "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      ...options
    });

    this.setupEventHandlers();
    logger.info('WebSocket service initialized');
    return this.io;
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Subscribe to task updates
      socket.on('subscribe_to_task', (taskId) => {
        this.subscribeToTask(socket, taskId);
      });

      // Unsubscribe from task updates
      socket.on('unsubscribe_from_task', (taskId) => {
        this.unsubscribeFromTask(socket, taskId);
      });

      // Request task status
      socket.on('request_task_status', (taskId) => {
        this.sendTaskStatus(socket, taskId);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleClientDisconnect(socket);
      });

      // Heartbeat to keep connection alive
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  subscribeToTask(socket, taskId) {
    try {
      logger.info(`Client ${socket.id} subscribed to task ${taskId}`);
      
      // Track client's task subscriptions
      if (!this.connectedClients.has(socket.id)) {
        this.connectedClients.set(socket.id, new Set());
      }
      this.connectedClients.get(socket.id).add(taskId);

      // Track which clients are watching this task
      if (!this.roomClients.has(taskId)) {
        this.roomClients.set(taskId, new Set());
      }
      this.roomClients.get(taskId).add(socket.id);

      // Join the task room
      socket.join(`task_${taskId}`);
      
      socket.emit('subscription_confirmed', {
        taskId,
        message: `Subscribed to task ${taskId}`
      });

    } catch (error) {
      logger.error('Error subscribing to task:', error);
      socket.emit('error', { message: 'Failed to subscribe to task' });
    }
  }

  unsubscribeFromTask(socket, taskId) {
    try {
      logger.info(`Client ${socket.id} unsubscribed from task ${taskId}`);
      
      // Remove from client's subscriptions
      if (this.connectedClients.has(socket.id)) {
        this.connectedClients.get(socket.id).delete(taskId);
      }

      // Remove from task's client list
      if (this.roomClients.has(taskId)) {
        this.roomClients.get(taskId).delete(socket.id);
      }

      socket.leave(`task_${taskId}`);
      
      socket.emit('unsubscription_confirmed', {
        taskId,
        message: `Unsubscribed from task ${taskId}`
      });

    } catch (error) {
      logger.error('Error unsubscribing from task:', error);
      socket.emit('error', { message: 'Failed to unsubscribe from task' });
    }
  }

  handleClientDisconnect(socket) {
    try {
      const clientSubscriptions = this.connectedClients.get(socket.id);
      if (clientSubscriptions) {
        // Remove this client from all task rooms
        clientSubscriptions.forEach(taskId => {
          if (this.roomClients.has(taskId)) {
            this.roomClients.get(taskId).delete(socket.id);
          }
        });
        this.connectedClients.delete(socket.id);
      }
      
      logger.info(`Client disconnected: ${socket.id}`);
    } catch (error) {
      logger.error('Error handling client disconnect:', error);
    }
  }

  // Broadcast task progress updates
  broadcastTaskProgress(taskId, progressData) {
    try {
      if (!this.io) return;
      
      const updateMessage = {
        taskId,
        type: 'progress',
        ...progressData,
        timestamp: new Date().toISOString()
      };

      this.io.to(`task_${taskId}`).emit('task_progress_update', updateMessage);
      
      logger.debug(`Broadcasted progress update for task ${taskId}:`, progressData);

    } catch (error) {
      logger.error('Error broadcasting task progress:', error);
    }
  }

  // Broadcast real-time search results
  broadcastTaskResults(taskId, resultsData) {
    try {
      if (!this.io) return;
      
      const updateMessage = {
        taskId,
        type: 'results',
        ...resultsData,
        timestamp: new Date().toISOString()
      };

      this.io.to(`task_${taskId}`).emit('task_results_update', updateMessage);
      
      logger.debug(`Broadcasted results update for task ${taskId}:`, {
        resultsCount: resultsData.results?.length || 0,
        batchStart: resultsData.batchStart || 0,
        totalResults: resultsData.totalResults || 0
      });

    } catch (error) {
      logger.error('Error broadcasting task results:', error);
    }
  }

  // Broadcast task completion
  broadcastTaskCompletion(taskId, completionData) {
    try {
      if (!this.io) return;
      
      const updateMessage = {
        taskId,
        type: 'completion',
        ...completionData,
        timestamp: new Date().toISOString()
      };

      this.io.to(`task_${taskId}`).emit('task_completion', updateMessage);
      
      logger.info(`Broadcasted completion for task ${taskId}`);

      // Clean up room after completion
      setTimeout(() => {
        this.cleanupTaskRoom(taskId);
      }, 30000); // Clean up after 30 seconds

    } catch (error) {
      logger.error('Error broadcasting task completion:', error);
    }
  }

  // Broadcast task error
  broadcastTaskError(taskId, errorData) {
    try {
      if (!this.io) return;
      
      const updateMessage = {
        taskId,
        type: 'error',
        ...errorData,
        timestamp: new Date().toISOString()
      };

      this.io.to(`task_${taskId}`).emit('task_error', updateMessage);
      
      logger.info(`Broadcasted error for task ${taskId}:`, errorData.message);

    } catch (error) {
      logger.error('Error broadcasting task error:', error);
    }
  }

  // Send task status to requesting client
  sendTaskStatus(socket, taskId) {
    try {
      const taskManager = require('../utils/taskManager');
      const task = taskManager.getTask(taskId);
      
      if (task) {
        socket.emit('task_status', {
          taskId,
          task: task,
          timestamp: new Date().toISOString()
        });
      } else {
        socket.emit('task_status', {
          taskId,
          task: null,
          error: 'Task not found',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error sending task status:', error);
      socket.emit('error', { message: 'Failed to get task status' });
    }
  }

  // Clean up a task room
  cleanupTaskRoom(taskId) {
    try {
      if (this.roomClients.has(taskId)) {
        this.roomClients.delete(taskId);
        logger.debug(`Cleaned up task room: ${taskId}`);
      }
    } catch (error) {
      logger.error('Error cleaning up task room:', error);
    }
  }

  // Get connection statistics
  getStats() {
    return {
      connectedClients: this.connectedClients.size,
      activeRooms: this.roomClients.size,
      roomDetails: Array.from(this.roomClients.entries()).map(([taskId, clients]) => ({
        taskId,
        clientCount: clients.size
      }))
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

module.exports = websocketService;
