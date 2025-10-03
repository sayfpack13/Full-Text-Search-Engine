const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Manages disk-based caching of search results for optimal performance
 * Eliminates need for re-executing searches when accessing task results
 */
class ResultCacheManager {
  constructor() {
    this.cacheDir = path.join(__dirname, '../data/search-results');
    this.chunkSize = 1000; // Number of results per cache chunk
    
    // Initialize cache directory
    this.initializeCache();
  }

  async initializeCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log('ResultCacheManager: Cache directory initialized');
    } catch (error) {
      console.error('ResultCacheManager initialization failed:', error);
    }
  }

  /**
   * Generate a deterministic cache key for search parameters
   */
  generateCacheKey(query, limit, offset) {
    const normalizedQuery = query.trim().toLowerCase();
    const key = `${normalizedQuery}_${limit}_${offset}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * Generate a base cache key for all results of a query (without pagination params)
   */
  generateBaseCacheKey(query) {
    const normalizedQuery = query.trim().toLowerCase();
    return crypto.createHash('md5').update(normalizedQuery).digest('hex');
  }

  /**
   * Save search results to disk as text file
   * @param {string} query - Search query
   * @param {Array} results - Full results array
   * @param {number} total - Total number of results
   * @param {string} taskId - Task ID for unique file naming
   * @returns {string} - Path to saved results file
   */
  async cacheResults(query, results, total, taskId) {
    try {
      const sanitizedQuery = query.trim().replace(/[<>:"/\\|?*]/g, '_');
      const timestamp = Date.now();
      const fileName = `${sanitizedQuery}_${taskId || timestamp}.txt`;
      const filePath = path.join(this.cacheDir, fileName);
      
      // Create cache directory if it doesn't exist
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Format results as readable text
      let content = `Search Results for Query: "${query.trim()}"\n`;
      content += `Total Results: ${total}\n`;
      content += `Cached At: ${new Date().toISOString()}\n`;
      content += `${'='.repeat(80)}\n\n`;
      
      results.forEach((result, index) => {
        content += `Result ${index + 1}:\n`;
        content += `File: ${result.path}\n`;
        content += `Line: ${result.line_number}\n`;
        content += `Score: ${result.score}\n`;
        content += `Content: ${result.content}\n`;
        content += `${'-'.repeat(40)}\n\n`;
      });
      
      // Save to text file
      await fs.writeFile(filePath, content, 'utf8');
      
      console.log(`Saved ${total} results for query "${query}" to ${fileName}`);
      
      return filePath;
      
    } catch (error) {
      console.error('Failed to save results to text file:', error);
      throw error;
    }
  }

  /**
   * Load results from saved text file by taskId
   * @param {string} taskId - Task ID to find the results file
   * @param {number} limit - Number of results to return
   * @param {number} offset - Starting offset
   * @returns {Object|null} - Results or null if not found
   */
  async loadCachedResultsByTaskId(taskId, limit = 50, offset = 0) {
    try {
      // Look for text file with this taskId
      const files = await fs.readdir(this.cacheDir);
      const resultFile = files.find(file => file.includes(`_${taskId}.txt`));
      
      if (!resultFile) {
        return null;
      }
      
      const filePath = path.join(this.cacheDir, resultFile);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Parse the text content back to structured data
      const lines = content.split('\n');
      const metadata = this.parseResultsMetadata(lines);
      
      if (!metadata) {
        console.error(`Failed to parse metadata from file: ${resultFile}`);
        return null;
      }
      
      // Extract results from text (skip metadata lines)
      const results = this.parseResultsFromText(lines, metadata);
      
      if (!results || results.length === 0) {
        console.error(`No results parsed from file: ${resultFile}`);
        return null;
      }
      
      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit);
      
      return {
        results: paginatedResults,
        total: metadata.totalResults,
        limit,
        offset,
        cached: true,
        sourceFile: resultFile
      };
      
    } catch (error) {
      console.error('Failed to load cached results by taskId:', error);
      return null;
    }
  }

  /**
   * Parse metadata from text file
   */
  parseResultsMetadata(lines) {
    try {
      const queryLine = lines.find(line => line.startsWith('Search Results for Query:'));
      const totalLine = lines.find(line => line.startsWith('Total Results:'));
      const cachedLine = lines.find(line => line.startsWith('Cached At:'));
      
      if (!queryLine || !totalLine) return null;
      
      const query = queryLine.match(/"([^"]*)"/)?.[1] || '';
      const totalResults = parseInt(totalLine.split(': ')[1]) || 0;
      const cachedAt = cachedLine?.split(': ')[1] || '';
      
      return {
        query: query.trim(),
        totalResults,
        cachedAt
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse results from text content
   */
  parseResultsFromText(lines, metadata) {
    const results = [];
    let currentResult = null;
    
    for (let i = 6; i < lines.length; i++) { // Skip header lines
      const line = lines[i];
      
      if (line.startsWith('Result ')) {
        if (currentResult && Object.keys(currentResult).length > 0) {
          results.push(currentResult);
        }
        currentResult = {};
      } else if (line.startsWith('File: ')) {
        if (currentResult) {
          currentResult.path = line.substring(6);
        }
      } else if (line.startsWith('Line: ')) {
        if (currentResult) {
          currentResult.line_number = parseInt(line.substring(6));
        }
      } else if (line.startsWith('Score: ')) {
        if (currentResult) {
          currentResult.score = parseFloat(line.substring(7));
        }
      } else if (line.startsWith('Content: ')) {
        if (currentResult) {
          currentResult.content = line.substring(9);
        }
      }
    }
    
    // Add the last result if it exists and has content
    if (currentResult && Object.keys(currentResult).length > 0) {
      results.push(currentResult);
    }
    
    return results;
  }

  /**
   * Check if results are cached for a task
   * @param {string} taskId - Task ID
   * @returns {boolean} - True if cached
   */
  async isTaskCached(taskId) {
    try {
      const files = await fs.readdir(this.cacheDir);
      return files.some(file => file.includes(`_${taskId}.txt`));
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove cached results for a task
   * @param {string} taskId - Task ID
   */
  async removeTaskResults(taskId) {
    try {
      const files = await fs.readdir(this.cacheDir);
      const resultFile = files.find(file => file.includes(`_${taskId}.txt`));
      
      if (resultFile) {
        const filePath = path.join(this.cacheDir, resultFile);
        await fs.rm(filePath, { force: true });
        console.log(`Removed cached results for task ${taskId}`);
      }
    } catch (error) {
      console.error('Failed to remove task results:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  async getCacheStats() {
    try {
      const entries = await fs.readdir(this.cacheDir);
      let totalEntries = 0;
      let totalSize = 0;
      
      for (const entry of entries) {
        const entryPath = path.join(this.cacheDir, entry);
        const stats = await fs.stat(entryPath);
        
        if (stats.isDirectory()) {
          totalEntries++;
          totalSize += stats.size;
        } 
      }
      
      return {
        totalEntries,
        totalSizeMB: Math.round(totalSize / 1024 / 1024),
        cacheDir: this.cacheDir,
        persistent: true // Results persist forever
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalEntries: 0,
        totalSizeMB: 0,
        cacheDir: this.cacheDir,
        persistent: true
      };
    }
  }

  /**
   * Clean up all caches (manual operation only)
   * @returns {number} - Number of caches cleaned
   */
  async cleanupAllCaches() {
    try {
      const entries = await fs.readdir(this.cacheDir);
      let cleanedCount = 0;
      
      for (const entry of entries) {
        const entryPath = path.join(this.cacheDir, entry);
        const stats = await fs.stat(entryPath);
        
        if (stats.isDirectory()) {
          await fs.rm(entryPath, { recursive: true });
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`ResultCacheManager: Cleaned ${cleanedCount} cached results (manual cleanup)`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('Failed to cleanup cached results:', error);
      return 0;
    }
  }
}

module.exports = new ResultCacheManager();
