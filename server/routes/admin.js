const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const rustEngine = require('../utils/rustEngine');
const { ValidationError } = require('../middleware/errorHandler');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Configure multer for text file uploads
const upload = multer({
  dest: 'searches/', // Upload directly to search directory
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Limit concurrent uploads
  },
  fileFilter: (req, file, cb) => {
    // Only accept .txt files for direct search
    if (file.originalname.toLowerCase().endsWith('.txt') || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new ValidationError('Only .txt files are supported', 'document'), false);
    }
  },
  storage: multer.diskStorage({
    destination: 'searches/',
    filename: (req, file, cb) => {
      // Preserve original filename with timestamp to avoid conflicts
      const timestamp = Date.now();
      const originalName = path.parse(file.originalname).name;
      const extension = path.parse(file.originalname).ext;
      cb(null, `${originalName}-${timestamp}${extension}`);
    }
  })
});

// Upload text documents for direct search
router.post('/upload', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded', 'document');
    }

    // File is already validated by multer filter and uploaded to searches/ directory
    
    // Validate text content - ensure it's readable UTF-8
    const fileContent = await fs.readFile(req.file.path, 'utf8');
    if (!fileContent.trim()) {
      // Clean up empty file
      await fs.unlink(req.file.path);
      throw new ValidationError('Empty text file is not supported', 'document');
    }

    // Run maintenance to refresh file cache (since we added a new file)
    await rustEngine.runMaintenance('cleanup');

    logger.info(`Text document uploaded successfully: ${req.file.originalname}`);

    res.json({
      success: true,
      data: {
        message: 'Text document uploaded successfully and is now searchable',
        filename: req.file.originalname,
        searchPath: req.file.path,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup uploaded file:', cleanupError.message);
      }
    }
    next(error);
  }
});

// Delete all search files
router.delete('/files', async (req, res, next) => {
  try {
    const result = await rustEngine.runMaintenance('clear-all');

    logger.info('All search files deleted successfully');
    res.json({
      success: true,
      data: {
        message: 'All search files deleted successfully',
        result
      }
    });

  } catch (error) {
    logger.error('Failed to delete all search files:', error);
    next(error);
  }
});

// Get system status
router.get('/status', async (req, res, next) => {
  try {
    const status = await rustEngine.getStatus();
    
    res.json({
      success: true,
      data: {
        ...status,
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
