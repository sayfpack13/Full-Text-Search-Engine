const rustEngine = require('../utils/rustEngine');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

const runBackgroundTasks = async () => {
  try {
    logger.info('Starting background maintenance tasks...');
    
    // Task 1: Optimize index
    await runTask('optimize', 'Optimizing search index...');
    
    // Task 2: Clean up temporary files
    await runTask('cleanup', 'Cleaning up temporary files...');
    
    // Task 3: Update statistics
    await runTask('update-stats', 'Updating search statistics...');
    
    logger.info('Background maintenance tasks completed successfully');
    
  } catch (error) {
    logger.error('Background tasks failed:', error);
    throw error;
  }
};

const runTask = async (taskName, description) => {
  try {
    logger.info(description);
    const result = await rustEngine.runMaintenance(taskName);
    logger.info(`Task ${taskName} completed successfully`);
    return result;
  } catch (error) {
    logger.error(`Task ${taskName} failed:`, error);
    throw error;
  }
};

module.exports = {
  runBackgroundTasks
};
