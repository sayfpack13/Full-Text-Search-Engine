const express = require('express');
const taskManager = require('../utils/taskManager');
const asyncSearchService = require('../services/asyncSearchService');
const { ValidationError, ServerTaskError } = require('../middleware/errorHandler');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Create and execute async search task
router.post('/search', async (req, res, next) => {
  try {
    const { query, limit = 10, offset = 0, async = true } = req.body;

    // Validation
    if (!query || query.trim().length === 0) {
      throw new ValidationError('Search query is required', 'query');
    }

    if (typeof limit !== 'number' || limit < -1 || limit === 0) {
      throw new ValidationError('Limit must be a positive number or -1 for unlimited', 'limit');
    }
    
    // Convert -1 to a very large number for unlimited results
    const actualLimit = limit === -1 ? 10000 : Math.min(limit, 10000);

    if (typeof offset !== 'number' || offset < 0) {
      throw new ValidationError('Offset must be a non-negative number', 'offset');
    }

    if (async) {
      // Create task for async processing
      const task = await taskManager.createTask('search', {
        query: query.trim(),
        limit,
        offset,
        operation: 'Searching files...'
      });

      // Start async execution (don't await)
      asyncSearchService.executeSearch(query.trim(), actualLimit, offset, task.id)
        .catch(error => {
          logger.error(`Async search task ${task.id} failed:`, error.message);
        });

      res.json({
        success: true,
        message: 'Search task started',
        data: {
          taskId: task.id,
          status: task.status,
          query: query.trim(),
          limit,
          offset,
          taskType: 'search',
          estimatedDuration: taskManager.estimateTaskDuration('search', { query: query.trim() }),
          createdAt: task.created.toISOString()
        }
      });

    } else {
      // Execute search synchronously (legacy behavior)
      const result = await asyncSearchService.executeSearch(query.trim(), actualLimit, offset);
      res.json(result);
    }

  } catch (error) {
    next(error);
  }
});

// Create maintenance task
router.post('/maintenance', async (req, res, next) => {
  try {
    const { task, async = true } = req.body;

    if (!task) {
      throw new ValidationError('Maintenance task is required', 'task');
    }

    const allowedTasks = ['cleanup', 'clear-all', 'update-stats'];
    if (!allowedTasks.includes(task)) {
      throw new ValidationError(`Invalid maintenance task: ${task}`, 'task');
    }

    if (async) {
      // Create task for async processing
      const task_obj = await taskManager.createTask('maintenance', {
        task,
        operation: `Running maintenance: ${task}`
      });

      // Start async execution
      asyncSearchService.executeMaintenance(task, task_obj.id)
        .catch(error => {
          logger.error(`Async maintenance task ${task_obj.id} failed:`, error.message);
        });

      res.json({
        success: true,
        message: 'Maintenance task started',
        data: {
          taskId: task_obj.id,
          status: task_obj.status,
          task,
          taskType: 'maintenance',
          estimatedDuration: taskManager.estimateTaskDuration('maintenance', { task }),
          createdAt: task_obj.created.toISOString()
        }
      });

    } else {
      // Execute maintenance synchronously
      const result = await asyncSearchService.executeMaintenance(task);
      res.json(result);
    }

  } catch (error) {
    next(error);
  }
});

// Get task status
router.get('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const task = taskManager.getTask(taskId);
    if (!task) {
      throw new ServerTaskError(`Task not found: ${taskId}`, taskId);
    }

    res.json({
      success: true,
      data: task
    });

  } catch (error) {
    next(error);
  }
});

// Get task results (lazy loading for scalability)
router.get('/:taskId/results', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { limit = 50, offset = 0, stream = false } = req.query;
    
    const task = taskManager.getTask(taskId);
    
    if (!task) {
      throw new ValidationError('Task not found', 'taskId');
    }
    
    if (task.status !== 'completed') {
      throw new ValidationError('Task must be completed to fetch results', 'status');
    }
    
    if (!task.result?.lazyLoad) {
      // Legacy task with results already loaded, return existing results
      const results = task.result.results || [];
      return res.json({
        success: true,
        data: {
          results: results.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
          total: task.result.total || results.length,
          offset: parseInt(offset),
          limit: parseInt(limit),
          cached: true
        }
      });
    }
    
    // New lazy-loaded task - re-execute search
    const searchParams = task.result.searchParams;
    const rustEngine = require('../utils/rustEngine');
    
    logger.info(`Lazy loading results for task ${taskId}: "${searchParams.query}"`);
    
    // Execute search with requested pagination
    const searchResults = await rustEngine.search(
      searchParams.query, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({
      success: true,
      data: {
        results: searchResults.results || [],
        total: task.result.total || searchResults.total || 0, // Use saved total from task
        offset: parseInt(offset),
        limit: parseInt(limit),
        cached: false,
        taskId: taskId
      }
    });

  } catch (error) {
    logger.error('Error fetching task results:', error);
    next(error);
  }
});

// List all tasks
router.get('/', async (req, res, next) => {
  try {
    const { status, type, limit } = req.query;
    
    let tasks = taskManager.getAllTasks();

    // Filter by status
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }

    // Filter by type
    if (type) {
      tasks = tasks.filter(task => task.type === type);
    }

    // Limit results
    if (limit) {
      tasks = tasks.slice(0, parseInt(limit));
    }

    res.json({
      success: true,
      data: {
        tasks,
        total: tasks.length,
        activeTasks: taskManager.getActiveTask().length
      }
    });

  } catch (error) {
    next(error);
  }
});

// Cancel running task
router.delete('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    
    const task = taskManager.getTask(taskId);
    if (!task) {
      throw new ServerTaskError(`Task not found: ${taskId}`, taskId);
    }

    if (task.status === 'completed' || task.status === 'failed') {
      throw new ValidationError('Cannot cancel completed or failed task', 'taskId');
    }

    // Mark task as failed (cancelled)
    await taskManager.updateTaskStatus(taskId, 'failed', {
      error: 'Task cancelled by user',
      operation: 'Task cancelled'
    });

    logger.info(`Task ${taskId} cancelled by user`);

    res.json({
      success: true,
      message: 'Task cancelled successfully',
      data: {
        taskId,
        status: 'failed'
      }
    });

  } catch (error) {
    next(error);
  }
});

// Delete a specific task (use /delete/:taskId to differentiate from cancel)
router.delete('/delete/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    
    const task = taskManager.getTask(taskId);
    if (!task) {
      throw new ValidationError('Task not found', 'taskId');
    }

    const success = await taskManager.deleteTask(taskId);
    
    logger.info(`Task ${taskId} deleted by user`);

    res.json({
      success: true,
      message: 'Task deleted successfully',
      data: {
        taskId,
        deleted: success
      }
    });

  } catch (error) {
    next(error);
  }
});

// Delete all tasks
router.delete('/', async (req, res, next) => {
  try {
    const deletedCount = await taskManager.deleteAllTasks();
    
    logger.info(`All ${deletedCount} tasks deleted by user`);

    res.json({
      success: true,
      message: `Deleted all ${deletedCount} tasks`,
      data: {
        deletedCount
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
