const { spawn } = require('child_process');
const { SearchEngineError } = require('../middleware/errorHandler');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class RustEngine {
  constructor() {
    this.binaryPath = process.env.RUST_SEARCH_BINARY || './rust-search-engine/target/release/search-engine.exe';
    this.isAvailable = false;
    this.lastAvailabilityCheck = 0;
    this.availabilityCheckInterval = 30000; // 30 seconds
    this.activeCommands = 0;
    this.maxConcurrentCommands = 3;
    this.commandQueue = [];
    this.checkAvailability();
    this.startHealthMonitoring();
  }

  async checkAvailability() {
    const now = Date.now();
    
    // Skip check if already checked recently
    if (this.isAvailable && (now - this.lastAvailabilityCheck) < this.availabilityCheckInterval) {
      return this.isAvailable;
    }

    try {
      logger.info(`Checking Rust engine availability at: ${this.binaryPath}`);
      
      const checkProcess = spawn(this.binaryPath, ['status'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, SEARCH_DIRECTORY: 'searches' }
      });

      let resolved = false;
      
      const checkPromise = new Promise((resolve) => {
        checkProcess.on('close', (code) => {
          if (resolved) return;
          resolved = true;
          
          this.lastAvailabilityCheck = now;
          this.isAvailable = code === 0;
          
          logger.info(`Rust engine check completed with code: ${code}`);
          if (this.isAvailable) {
            logger.info('Rust search engine is available');
          } else {
            logger.warn('Rust search engine is not available');
          }
          
          resolve(this.isAvailable);
        });

        checkProcess.on('error', (error) => {
          if (resolved) return;
          resolved = true;
          
          this.lastAvailabilityCheck = now;
          this.isAvailable = false;
          logger.warn('Rust search engine check failed:', error.message);
          resolve(false);
        });
      });

      // Timeout after 10 seconds (increased from 5)
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          
          logger.warn('Rust search engine check timed out');
          checkProcess.kill();
          this.lastAvailabilityCheck = now;
          this.isAvailable = false;
          resolve(false);
        }, 10000);
      });

      return await Promise.race([checkPromise, timeoutPromise]);
    } catch (error) {
      this.isAvailable = false;
      this.lastAvailabilityCheck = now;
      logger.error('Failed to check Rust engine availability:', error);
      return false;
    }
  }

  async executeCommand(command, args = [], timeout = 30000) {
    // Check availability before proceeding
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new SearchEngineError(
        'Search engine service is not available. Please contact administrator.',
        'SERVICE_UNAVAILABLE',
        503
      );
    }

    // Handle concurrency control
    return new Promise((resolve, reject) => {
      const executeWithRetry = async (retryCount = 0) => {
        // Wait if too many concurrent commands
        if (this.activeCommands >= this.maxConcurrentCommands) {
          this.commandQueue.push({ command, args, timeout, resolve, reject, retryCount });
          return;
        }

        this.activeCommands++;
        
        try {
          await this.runCommand(command, args, timeout, resolve, reject, retryCount);
        } catch (error) {
          this.activeCommands--;
          reject(error);
        }
      };

      executeWithRetry();
    });
  }

  async runCommand(command, args, timeout, resolve, reject, retryCount = 0) {
    let output = '';
    let errorOutput = '';
    let isResolved = false;
    const maxRetries = 3;

    const rustProcess = spawn(this.binaryPath, [command, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, SEARCH_DIRECTORY: 'searches' }
    });

    const cleanup = () => {
      this.activeCommands--;
      
      // Process any waiting commands
      if (this.commandQueue.length > 0) {
        const waitingCommand = this.commandQueue.shift();
        setTimeout(() => this.executeCommand(waitingCommand.command, waitingCommand.args, waitingCommand.timeout)
          .then(waitingCommand.resolve)
          .catch(waitingCommand.reject), 100);
      }
    };

    rustProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    rustProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    rustProcess.on('close', (code) => {
      if (isResolved) return;
      isResolved = true;
      cleanup();

      if (code !== 0) {
        logger.error(`Rust engine command failed: ${command}`, {
          code,
          error: errorOutput,
          args,
          retryCount
        });
        
        // Retry on failure if under retry limit
        if (retryCount < maxRetries) {
          logger.info(`Retrying command ${command} (attempt ${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            this.activeCommands++;
            this.runCommand(command, args, timeout, resolve, reject, retryCount + 1);
          }, Math.pow(2, retryCount) * 1000); // Exponential backoff
          return;
        }
        
        reject(new SearchEngineError(
          'Search engine operation failed',
          'SEARCH_ENGINE_ERROR',
          500
        ));
        return;
      }

      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (parseError) {
        logger.error('Failed to parse Rust engine output:', parseError);
        reject(new SearchEngineError(
          'Invalid response from search engine',
          'PARSE_ERROR',
          500
        ));
      }
    });

    rustProcess.on('error', (error) => {
      if (isResolved) return;
      isResolved = true;
      cleanup();

      logger.error('Failed to execute Rust engine command:', error);
      
      // Retry on transient errors
      if (retryCount < maxRetries && error.code !== 'ENOENT') {
        logger.info(`Retrying command ${command} after error (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          this.activeCommands++;
          this.runCommand(command, args, timeout, resolve, reject, retryCount + 1);
        }, Math.pow(2, retryCount) * 1000);
        return;
      }
      
      if (error.code === 'ENOENT') {
        reject(new SearchEngineError(
          'Search engine binary not found. Please contact administrator.',
          'BINARY_NOT_FOUND',
          503
        ));
      } else {
        reject(new SearchEngineError(
          'Search engine service is temporarily unavailable',
          'SERVICE_UNAVAILABLE',
          503
        ));
      }
    });

    // Timeout handling
    setTimeout(() => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      
      rustProcess.kill();
      
      // Retry on timeout
      if (retryCount < maxRetries) {
        logger.info(`Retrying command ${command} after timeout (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          this.activeCommands++;
          this.runCommand(command, args, timeout, resolve, reject, retryCount + 1);
        }, Math.pow(2, retryCount) * 1000);
        return;
      }
      
      reject(new SearchEngineError(
        'Search engine operation timed out',
        'TIMEOUT',
        504
      ));
    }, timeout);
  }

  async waitForReady() {
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const isAvailable = await this.checkAvailability();
      if (isAvailable) {
        return true;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new SearchEngineError(
      'Search engine is not ready after maximum attempts',
      'SERVICE_UNAVAILABLE',
      503
    );
  }

  // Start periodic health monitoring
  startHealthMonitoring() {
    setInterval(async () => {
      try {
        await this.checkAvailability();
        logger.debug(`Health check: Engine available=${this.isAvailable}, Active commands=${this.activeCommands}, Queue length=${this.commandQueue.length}`);
      } catch (error) {
        logger.error('Health monitoring error:', error);
      }
    }, 60000); // Check every minute
  }

  getStatus() {
    return {
      available: this.isAvailable,
      activeCommands: this.activeCommands,
      queueLength: this.commandQueue.length,
      maxConcurrentCommands: this.maxConcurrentCommands,
      lastAvailabilityCheck: this.lastAvailabilityCheck,
      binaryPath: this.binaryPath
    };
  }

  async search(query, limit = 10, offset = 0) {
    // Use very long timeout for large file searches (1 hour for massive log files)
    return this.executeCommand('search', [query, '--limit', limit.toString(), '--offset', offset.toString()], 3600000);
  }

  async getStats() {
    return this.executeCommand('stats');
  }

  async getStatus() {
    return this.executeCommand('status');
  }



  async runMaintenance(task) {
    return this.executeCommand('maintenance', [task]);
  }
}

// Create singleton instance
const rustEngine = new RustEngine();

module.exports = rustEngine;
