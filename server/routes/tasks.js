const express = require('express');
const taskManager = require('../utils/taskManager');
const asyncSearchService = require('../services/asyncSearchService');
const resultCacheManager = require('../utils/resultCacheManager');
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
    
    if (task.status !== 'completed' && task.status !== 'running' && task.status !== 'failed' && task.status !== 'stopped') {
      throw new ValidationError('Task must be running, completed, failed, or stopped to fetch results', 'status');
    }
    
    // Handle running tasks - try to load from progressive results file first
    if (task.status === 'running') {
      // Loading results for running task
      
      // Try to load from progressive results file
      const progressiveResults = await resultCacheManager.loadProgressiveResults(taskId, parseInt(limit), parseInt(offset));
      
      if (progressiveResults && progressiveResults.results.length > 0) {
        // Loaded progressive results for running task
        
        return res.json({
          success: true,
          data: {
            taskId,
            query: task.params?.query || 'Unknown',
            results: progressiveResults.results,
            total: progressiveResults.total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            filesSearched: task.result?.filesSearched || 0,
            status: 'running',
            progress: task.progress || 0,
            operation: task.operation || 'Searching...',
            cached: true,
            progressive: true,
            source: 'progressive_file',
            sourceFile: progressiveResults.sourceFile
          }
        });
      }
      
      // Fallback to in-memory results
      const currentResults = task.result?.results || [];
      const paginatedResults = currentResults.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
      
      return res.json({
        success: true,
        data: {
          taskId,
          query: task.params?.query || 'Unknown',
          results: paginatedResults,
          total: currentResults.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          filesSearched: task.result?.filesSearched || 0,
          status: 'running',
          progress: task.progress || 0,
          operation: task.operation || 'Searching...',
          cached: false,
          source: 'live_progress'
        }
      });
    }
    
    // Handle stopped tasks (user cancelled with saved results) - try to load from saved text file first
    if (task.status === 'stopped') {
      const cachedResults = await resultCacheManager.loadCachedResultsByTaskId(taskId, parseInt(limit), parseInt(offset));
      
      if (cachedResults) {
        logger.info(`Loading saved results from text file for stopped task ${taskId}`);
        return res.json({
          success: true,
          data: {
            results: cachedResults.results,
            total: cachedResults.total,
            offset: parseInt(offset),
            limit: parseInt(limit),
            cached: true,
            sourceFile: cachedResults.sourceFile,
            taskId: taskId,
            status: 'stopped',
            stopped: true,
            userInitiated: true
          }
        });
      } else {
        // Stopped task with no saved results
        return res.json({
          success: true,
          data: {
            taskId,
            query: task.params?.query || 'Unknown',
            results: [],
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset),
            status: 'stopped',
            stopped: true,
            userInitiated: true,
            message: 'Task was stopped by user but no results were saved'
          }
        });
      }
    }
    
    // Handle failed tasks (cancelled with saved results) - try to load from saved text file first
    if (task.status === 'failed') {
      const cachedResults = await resultCacheManager.loadCachedResultsByTaskId(taskId, parseInt(limit), parseInt(offset));
      
      if (cachedResults) {
        logger.info(`Loading saved results from text file for failed/cancelled task ${taskId}`);
        return res.json({
          success: true,
          data: {
            results: cachedResults.results,
            total: cachedResults.total,
            offset: parseInt(offset),
            limit: parseInt(limit),
            cached: true,
            sourceFile: cachedResults.sourceFile,
            taskId: taskId,
            status: 'failed',
            cancelled: true
          }
        });
      } else {
        // Failed task with no saved results
        return res.json({
          success: true,
          data: {
            taskId,
            query: task.params?.query || 'Unknown',
            results: [],
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset),
            status: 'failed',
            cancelled: true,
            message: 'Task was cancelled but no results were saved'
          }
        });
      }
    }
    
    // Handle completed tasks - try to load from saved text file first
    const cachedResults = await resultCacheManager.loadCachedResultsByTaskId(taskId, parseInt(limit), parseInt(offset));
    
    if (cachedResults) {
      logger.info(`Loading saved results from text file for completed task ${taskId}`);
      return res.json({
        success: true,
        data: {
          results: cachedResults.results,
          total: cachedResults.total,
          offset: parseInt(offset),
          limit: parseInt(limit),
          cached: true,
          sourceFile: cachedResults.sourceFile,
          taskId: taskId,
          status: 'completed'
        }
      });
    }
    
    // Fallback: re-execute search if no saved file found
    logger.info(`No saved results found for task ${taskId}, re-executing search`);
    const query = task.result.query || task.result.searchParams?.query;
    if (!query) {
      throw new ValidationError('Task query not found', 'query');
    }
    
    const rustEngine = require('../utils/rustEngine');
    
    // Execute search with requested pagination
    const searchResults = await rustEngine.search(query, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      data: {
        results: searchResults.results || [],
        total: task.result.total || searchResults.total || 0,
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

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'stopped') {
      throw new ValidationError('Cannot cancel completed, failed, or stopped task', 'taskId');
    }

    // Cancel the actual running task process
    const asyncSearchService = require('../services/asyncSearchService');
    const wasRunning = asyncSearchService.cancelTask(taskId);
    
    // Save any progressive results before cancelling
    let finalResultsPath = null;
    let totalResultsFound = 0;
    
    if (task.status === 'running' && task.type === 'search') {
      try {
        // Try to load any progressive results that were found
        const progressiveResults = await resultCacheManager.loadProgressiveResults(taskId);
        
        if (progressiveResults && progressiveResults.results.length > 0) {
          const totalFound = progressiveResults.total;
          
          // Finalize the progressive results file
          finalResultsPath = await resultCacheManager.finalizeProgressiveResults(taskId, totalFound);
          totalResultsFound = totalFound;
          
          // Saved results before stopping task
          
          // Update task with saved results info before marking as stopped
          await taskManager.updateTaskStatus(taskId, 'stopped', {
            operation: 'Task stopped with saved results',
            progress: 100,
            result: {
              ...task.result,
              total: totalFound,
              saved: true,
              progressiveResultsPath: finalResultsPath,
              resultsFound: totalFound,
              stopped: true
            }
          });
        } else {
          // No results to save, just mark as stopped
          await taskManager.updateTaskStatus(taskId, 'stopped', {
            operation: 'Task stopped (no results found)',
            progress: task.progress || 0,
            result: {
              ...task.result,
              saved: false,
              stopped: true
            }
          });
        }
      } catch (saveError) {
        logger.warn(`Failed to save results before cancelling task ${taskId}: ${saveError.message}`);
        
        // Still stop the task even if saving failed
        await taskManager.updateTaskStatus(taskId, 'stopped', {
          operation: 'Task stopped (save failed)',
          progress: task.progress || 0,
          result: {
            ...task.result,
            saved: false,
            stopped: true,
            saveError: saveError.message
          }
        });
      }
    } else {
      // For non-search tasks or non-running tasks, just mark as stopped
      await taskManager.updateTaskStatus(taskId, 'stopped', {
        operation: 'Task stopped',
        progress: task.progress || 0,
        result: {
          ...task.result,
          stopped: true
        }
      });
    }

    logger.info(`Task ${taskId} stopped by user${finalResultsPath ? ` (${totalResultsFound} results saved)` : ''}`);

    res.json({
      success: true,
      message: finalResultsPath 
        ? `Task stopped successfully. ${totalResultsFound} results were saved.`
        : wasRunning 
        ? 'Task stopped successfully.' 
        : 'Task stopped successfully.',
      data: {
        taskId,
        status: 'stopped',
        wasRunning: wasRunning,
        resultsSaved: finalResultsPath ? totalResultsFound : 0,
        resultsFile: finalResultsPath,
        savedResults: !!finalResultsPath
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
