const express = require('express');
const rustEngine = require('../utils/rustEngine');
const { ValidationError } = require('../middleware/errorHandler');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Scalability and caching utilities
const searchSessions = new Map();

function generateSessionId() {
  return 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}


// Search endpoint with caching and streaming support
router.post('/query', async (req, res, next) => {
  try {
    const { 
      query, 
      limit = 50, 
      offset = 0, 
      stream = false,
      sessionId: providedSessionId
    } = req.body;

    // Validation
    if (!query || query.trim().length === 0) {
      throw new ValidationError('Search query is required', 'query');
    }

    if (typeof limit !== 'number' || limit < 1 || limit > 1000) {
      throw new ValidationError('Limit must be between 1 and 1000', 'limit');
    }

    if (typeof offset !== 'number' || offset < 0) {
      throw new ValidationError('Offset must be a non-negative number', 'offset');
    }

    const sessionId = providedSessionId || generateSessionId();
    const searchParams = { 
      query: query.trim(), 
      limit, 
      offset 
    };


    // Handle streaming for large result sets
    if (stream || limit > 100) {
      await handleStreamingSearch(res, searchParams, sessionId);
      return;
    }

    // Execute regular search
    const results = await rustEngine.search(query.trim(), limit, offset);
    
    // Enhance with pagination metadata
    const enhancedResults = {
      query: query.trim(),
      results: results.results || [],
      total: results.total || 0,
      limit,
      offset,
      pagination: {
        offset,
        limit,
        total: results.total || 0,
        hasMore: (offset + limit) < (results.total || 0),
        nextOffset: offset + limit
      },
      sessionId,
      timestamp: new Date().toISOString()
    };

    // Update session
    searchSessions.set(sessionId, {
      ...searchParams,
      createdAt: new Date(),
      lastAccessed: new Date(),
      resultCount: enhancedResults.total
    });
    
    logger.info(`Search completed for query: "${query}", returned ${enhancedResults.results.length} results`);
    
    res.json({
      success: true,
      data: enhancedResults
    });

  } catch (error) {
    next(error);
  }
});

// Streaming search implementation
async function handleStreamingSearch(res, searchParams, sessionId) {
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache'
  });

  try {
    // Send startup message
    res.write(JSON.stringify({
      type: 'start',
      sessionId,
      query: searchParams.query,
      timestamp: new Date().toISOString()
    }) + '\n');

    let chunkOffset = searchParams.offset || 0;
    let totalResults = 0;
    let processedResults = 0;
    const chunkSize = 100;

    // Stream all results in chunks
    while (true) {
      const chunkResults = await rustEngine.search(searchParams.query, chunkSize, chunkOffset);
      
      if (chunkOffset === 0) {
        totalResults = chunkResults.total || 0;
      }

      const results = chunkResults.results || [];
      processedResults += results.length;

      // Send chunk
      res.write(JSON.stringify({
        type: 'chunk',
        offset: chunkOffset,
        limit: chunkSize,
        results: results,
        total: totalResults,
        processed: processedResults,
        hasMore: (chunkOffset + chunkSize) < totalResults
      }) + '\n');

      chunkOffset += chunkSize;

      if (processedResults >= totalResults) {
        break;
      }

      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Send completion message
    res.write(JSON.stringify({
      type: 'complete',
      sessionId,
      totalResults,
      processedResults,
      timestamp: new Date().toISOString()
    }) + '\n');

  } catch (error) {
    res.write(JSON.stringify({
      type: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }) + '\n');
  } finally {
    res.end();
  }
}

// Get search statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await rustEngine.getStats();
    
    // Add session statistics
    const sessionStats = {
      ...stats,
      sessions: searchSessions.size,
      memoryUsage: process.memoryUsage().heapUsed
    };
    
    res.json({
      success: true,
      data: sessionStats
    });

  } catch (error) {
    next(error);
  }
});

// Session management endpoints
router.get('/session/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = searchSessions.get(sessionId);
    
    if (!session) {
      throw new ValidationError('Session not found', 'sessionId');
    }

    res.json({
      success: true,
      data: {
        sessionId,
        ...session,
        isActive: true
      }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/session/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    if (searchSessions.has(sessionId)) {
      searchSessions.delete(sessionId);
      
      
      res.json({
        success: true,
        message: 'Session cleared successfully'
      });
    } else {
      throw new ValidationError('Session not found', 'sessionId');
    }
  } catch (error) {
    next(error);
  }
});

// Session management endpoints
router.delete('/sessions', async (req, res, next) => {
  try {
    const beforeSize = searchSessions.size;
    searchSessions.clear();
    
    logger.info(`Sessions cleared. Removed ${beforeSize} search sessions`);
    
    res.json({
      success: true,
      message: `Cleared ${beforeSize} search sessions`,
      cleared: beforeSize
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
