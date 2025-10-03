const rustEngine = require('../utils/rustEngine');
const taskManager = require('../utils/taskManager');
const resultCacheManager = require('../utils/resultCacheManager');
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

      // Proceed directly with search - results will be saved to .txt file during execution

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

      // Execute search to get ALL results (not paginated) for saving
      logger.info(`Executing full search for saving: "${query}"`);
      const allResults = await rustEngine.search(query.trim(), 100000, 0); // Get up to 100k results for large files

      // Clear progress interval if it was set
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Extract relevant progress information
      const filesSearched = stats.total_documents || 1;
      const totalResults = allResults.total || 0;
      
      // Save results to text file if we have results
      let savedFilePath = null;
      if (totalResults > 0 && taskId) {
        try {
          savedFilePath = await resultCacheManager.cacheResults(
            query.trim(), 
            allResults.results || [], 
            totalResults,
            taskId
          );
          logger.info(`Successfully saved ${totalResults} results to ${savedFilePath}`);
        } catch (saveError) {
          logger.error('Failed to save results:', saveError.message);
        }
      }
      
      // Return paginated results from search results
      const paginatedResults = (allResults.results || []).slice(offset, offset + limit);
      
      // Complete the task with saved results info
      if (taskId) {
        await taskManager.updateTaskStatus(taskId, 'completed', {
          progress: 100,
          total: 100,
          operation: 'Search completed successfully',
          result: {
            query: query.trim(),
            total: totalResults,
            filesSearched,
            resultsFound: paginatedResults.length,
            executionTime: Date.now(),
            searchDuration: 0,
            limit,
            offset,
            saved: !!savedFilePath,
            resultsFile: savedFilePath,
            totalSaved: totalResults
          }
        });
      }

      logger.info(`Async search completed for query: "${query}" - Found ${totalResults} total results (saved: ${!!savedFilePath})`);
      
      return {
        success: true,
        taskId,
        data: {
          query: query.trim(),
          results: paginatedResults,
          total: totalResults,
          filesSearched,
          resultsFound: paginatedResults.length,
          executionTime: Date.now(),
          limit,
          offset,
          saved: !!savedFilePath
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
