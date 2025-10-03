const rustEngine = require('../utils/rustEngine');
const taskManager = require('../utils/taskManager');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class AsyncSearchService {
  async executeSearch(query, limit = 10, offset = 0, taskId = null) {
    try {
      // Update task to running status
      if (taskId) {
        await taskManager.updateTaskStatus(taskId, 'running', {
          progress: 5,
          operation: 'Initializing search...',
          result: { query, limit, offset }
        });
      }

      // Get file statistics first
      let stats;
      try {
        stats = await rustEngine.getStatus();
      } catch (error) {
        logger.warn('Failed to get file stats, proceeding with search anyway:', error.message);
        stats = { total_documents: 1 };
      }

      const estimatedFiles = stats.total_documents || 1;
      const estimatedDuration = taskManager.estimateTaskDuration('search', { 
        query, 
        filesCount: estimatedFiles 
      });

      // Start progress tracking for longer operations
      let progressInterval;
      if (taskId && estimatedDuration > 2000) {
        progressInterval = setInterval(async () => {
          if (taskId) {
            const task = taskManager.getTask(taskId);
            if (task && task.status === 'running') {
              const currentProgress = Math.min(task.progress + 15, 85);
              const operations = [
                'Initializing search...',
                'Scanning files...',
                'Processing content...',
                'Matching results...',
                'Sorting results...'
              ];
              const operationIndex = Math.min(Math.floor(currentProgress / 17), operations.length - 1);
              
              await taskManager.updateTaskStatus(taskId, 'running', {
                progress: currentProgress,
                operation: operations[operationIndex],
                total: 100
              });
            } else {
              clearInterval(progressInterval);
            }
          }
        }, Math.ceil(estimatedDuration / 6));
      }

      // Update task to show final progress before search
      if (taskId) {
        await taskManager.updateTaskStatus(taskId, 'running', {
          progress: 90,
          operation: 'Executing search query...',
          total: 100
        });
      }

      // Execute the actual search
      const results = await rustEngine.search(query.trim(), limit, offset);

      // Clear progress interval if it was set
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Extract relevant progress information
      const filesSearched = stats.total_documents || 1;
      const resultsFound = results.results?.length || 0;
      
      // Complete the task with metadata only (no full results for scalability)
      if (taskId) {
        await taskManager.updateTaskStatus(taskId, 'completed', {
          progress: 100,
          total: 100,
          operation: 'Search completed successfully',
          result: {
            query: query.trim(),
            // Store only metadata, not full results
            total: results.total || 0,
            filesSearched,
            resultsFound,
            executionTime: Date.now(),
            searchDuration: (Date.now() - Date.now()),
            limit,
            offset,
            // Lazy loading flag
            lazyLoad: true,
            // Store search parameters for re-execution when needed
            searchParams: { 
              query: query.trim(), 
              originalLimit: limit, 
              originalOffset: offset 
            }
          }
        });
      }

      logger.info(`Async search completed for query: "${query}" - Found ${resultsFound} results`);
      
      return {
        success: true,
        taskId,
        data: {
          query: query.trim(),
          results: results.results || [],
          total: results.total || 0,
          filesSearched,
          resultsFound,
          executionTime: Date.now(),
          limit,
          offset
        }
      };

    } catch (error) {
      logger.error(`Async search failed for query: "${query}":`, error.message);
      
      // Mark task as failed
      if (taskId) {
        await taskManager.updateTaskStatus(taskId, 'failed', {
          error: error.message,
          operation: 'Search failed'
        });
      }

      throw error;
    }
  }

  async executeMaintenance(task, taskId = null) {
    try {
      if (taskId) {
        await taskManager.updateTaskStatus(taskId, 'running', {
          progress: 0,
          operation: `Running maintenance: ${task}`
        });
      }

      // Simulate maintenance progress
      const progressSteps = ['Reading files', 'Processing', 'Completing'];
      let currentStep = 0;
      
      if (taskId) {
        const updateProgress = setInterval(async () => {
          if (taskId) {
            const task_obj = taskManager.getTask(taskId);
            if (task_obj && task_obj.status === 'running') {
              currentStep++;
              const progress = Math.min(currentStep * 33, 90);
              const operation = progressSteps[currentStep - 1] || 'Completing';
              
              await taskManager.updateTaskStatus(taskId, 'running', {
                progress,
                operation
              });
              
              if (currentStep >= progressSteps.length) {
                clearInterval(updateProgress);
              }
            } else {
              clearInterval(updateProgress);
            }
          }
        }, 500);
      }

      // Execute maintenance
      const result = await rustEngine.runMaintenance(task);

      if (taskId) {
        await taskManager.updateTaskStatus(taskId, 'completed', {
          progress: 100,
          operation: 'Maintenance completed',
          result
        });
      }

      logger.info(`Maintenance task "${task}" completed successfully`);
      return { success: true, taskId, result };

    } catch (error) {
      logger.error(`Maintenance task "${task}" failed:`, error.message);
      
      if (taskId) {
        await taskManager.updateTaskStatus(taskId, 'failed', {
          error: error.message,
          operation: 'Maintenance failed'
        });
      }

      throw error;
    }
  }
}

module.exports = new AsyncSearchService();
