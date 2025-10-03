const rustEngine = require('../utils/rustEngine');
const taskManager = require('../utils/taskManager');
const resultCacheManager = require('../utils/resultCacheManager');
const websocketService = require('./websocketService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class AsyncSearchService {
  constructor() {
    this.runningTasks = new Map(); // Track running task instances
  }

  async executeSearch(query, limit = 10, offset = 0, taskId = null) {
    try {
      // Initialize progressive results saving
      let progressiveResultsPath = null;
      if (taskId) {
        try {
          progressiveResultsPath = await resultCacheManager.initializeProgressiveResults(query.trim(), taskId);
          // Initialized progressive results file
        } catch (error) {
          logger.warn('Failed to initialize progressive results:', error.message);
        }
      }

      // Update task to running status
      if (taskId) {
        await taskManager.updateTaskStatus(taskId, 'running', {
          progress: 5,
          operation: 'Initializing search...',
          result: { query, limit, offset, progressiveResultsPath }
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

      // Register this task as running for cancellation tracking
      if (taskId) {
        this.runningTasks.set(taskId, {
          query: query.trim(),
          startTime: Date.now(),
          cancelled: false
        });
      }

      // Execute progressive streaming search to save results in real-time
      // Executing streaming search
      const allResults = await this.executeStreamingSearch(query.trim(), limit, offset, taskId);

      // Clear progress interval if it was set
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Cleanup task from running tasks tracker
      if (taskId) {
        this.runningTasks.delete(taskId);
      }

      // Extract relevant progress information
      const filesSearched = allResults.stats?.total_documents || 1;
      const totalResults = allResults.total || 0;
      
      // Results already saved progressively during streaming search
      // No need for additional caching - progressive results file serves as final cache
      
      // Task completion already handled by executeStreamingSearch finalization
      // No duplicate update needed here
      
      return {
        success: true,
        taskId,
        data: {
          query: query.trim(),
          total: totalResults,
          filesSearched,
          executionTime: Date.now(),
          limit,
          offset,
          saved: true // Results saved to progressive file
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

  async executeStreamingSearch(query, limit, offset, taskId) {
    try {
      const batchSize = 50; // Process results in batches of 50
      let totalResults = [];
      let currentOffset = offset;
      let hasMore = true;
      let totalFound = 0;
      let searchStats = null; // Store stats from search results
      
      // Starting streaming search
      
      while (hasMore && totalFound < 50000) { // Cap at 50k results for performance
        
        // Check for cancellation
        if (taskId && this.isTaskCancelled(taskId)) {
          // Task cancelled, stopping search
          throw new Error('Task cancelled');
        }
        
        // Broadcast progress update
        if (taskId) {
          websocketService.broadcastTaskProgress(taskId, {
            progress: Math.min(Math.round((currentOffset / Math.max(limit, 1000)) * 80), 75),
            operation: `Found ${totalFound} results so far...`,
            resultsSoFar: totalFound,
            currentBatch: Math.floor(currentOffset / batchSize) + 1
          });
        }
        
        // Get next batch of results
        const batchResults = await rustEngine.search(query, batchSize, currentOffset);
        
        if (!batchResults.results || batchResults.results.length === 0) {
          // No more results found
          break;
        }
        
        totalResults.push(...batchResults.results);
        totalFound += batchResults.results.length;
        currentOffset += batchSize;
        
        // Update total and capture stats from first batch
        if (currentOffset === offset + batchSize) {
          totalFound = batchResults.total || batchResults.length;
          searchStats = batchResults.stats; // Capture stats from search results
        }
        
          // Broadcast results as they're found
          if (taskId && batchResults.results.length > 0) {
            websocketService.broadcastTaskResults(taskId, {
              results: batchResults.results,
              batchStart: totalResults.length - batchResults.results.length,
              batchSize: batchResults.results.length,
              totalResults: totalFound,
              hasMore: currentOffset < totalFound,
              totalFound: totalFound
            });

            // Save results progressively to file
            try {
              await resultCacheManager.appendProgressiveResults(taskId, batchResults.results);
              
                // Update task with latest results count (no results array stored in JSON)
                await taskManager.updateTaskStatus(taskId, 'running', {
                  progress: Math.min(Math.round((currentOffset / Math.max(limit, 1000)) * 90), 85),
                  operation: `Found ${totalFound} results...`,
                  result: {
                    query,
                    totalFound,
                    progressiveResultsPath: `ongoing_batch_${Math.floor(currentOffset / batchSize)}`,
                    saved: true
                  }
                });
            } catch (saveError) {
              logger.warn(`Failed to save progressive results batch: ${saveError.message}`);
            }
          }
        
        // Check if we have enough results or no more data
        if (batchResults.results.length < batchSize || currentOffset >= totalFound) {
          hasMore = false;
        }
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Streaming search completed
      
      // Finalize progressive results file
      if (taskId) {
        try {
          const finalPath = await resultCacheManager.finalizeProgressiveResults(taskId, totalFound);
          logger.info(`Finalized progressive results: ${finalPath}`);
          
          // Update task with final status (no results array stored in JSON)
          await taskManager.updateTaskStatus(taskId, 'completed', {
            progress: 100,
            operation: 'Search completed',
            result: {
              query,
              totalFound,
              saved: true,
              progressiveResultsPath: finalPath,
              filesSearched: searchStats?.total_documents || 1
            }
          });
          
        } catch (finalizeError) {
          logger.warn(`Failed to finalize progressive results: ${finalizeError.message}`);
        }
      }
      
      return {
        query,
        total: totalFound,
        limit: offset + totalFound,
        offset,
        stats: searchStats
      };
      
    } catch (error) {
      logger.error(`Streaming search failed: ${error.message}`);
      
      // Save any partial results before failing
      if (taskId && error.message === 'Task cancelled') {
        try {
          const progressiveResults = await resultCacheManager.loadProgressiveResults(taskId);
          if (progressiveResults && progressiveResults.results.length > 0) {
            const finalPath = await resultCacheManager.finalizeProgressiveResults(taskId, progressiveResults.total);
            logger.info(`Saved ${progressiveResults.total} partial results due to cancellation: ${finalPath}`);
            
            // Update task with saved partial results (no results array stored in JSON)
            await taskManager.updateTaskStatus(taskId, 'stopped', {
              progress: Math.round((progressiveResults.total / Math.max(limit, 1000)) * 100),
              operation: 'Task stopped but results saved',
              result: {
                query,
                totalFound: progressiveResults.total,
                saved: true,
                progressiveResultsPath: finalPath,
                stopped: true
              }
            });
          }
        } catch (partialSaveError) {
          logger.warn(`Failed to save partial results on cancellation: ${partialSaveError.message}`);
        }
      }
      
      if (taskId) {
        websocketService.broadcastTaskError(taskId, {
          message: `Search failed: ${error.message}`,
          error: error.message
        });
      }
      
      throw error;
    }
  }
}

module.exports = new AsyncSearchService();

// Extend the singleton instance with additional methods
const searchService = module.exports;

// Cancel a running task
searchService.cancelTask = function(taskId) {
  if (this.runningTasks.has(taskId)) {
    this.runningTasks.get(taskId).cancelled = true;
      // Task marked for cancellation
    return true;
  }
  return false;
}

// Check if a task has been cancelled
searchService.isTaskCancelled = function(taskId) {
  const runningTask = this.runningTasks.get(taskId);
  return runningTask ? runningTask.cancelled : false;
}

// Get all running tasks
searchService.getRunningTasks = function() {
  return Array.from(this.runningTasks.keys());
}

// Remove finished task from tracking
searchService.removeRunningTask = function(taskId) {
  return this.runningTasks.delete(taskId);
}
