const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Login endpoint
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    // Check admin credentials
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username !== adminUsername || password !== adminPassword) {
      throw new AuthenticationError('Invalid username or password');
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        username: adminUsername, 
        role: 'admin',
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`Admin login successful: ${username}`);
    res.json({ 
      success: true,
      data: {
        token, 
        user: { username: adminUsername, role: 'admin' },
        message: 'Login successful'
      }
    });

  } catch (error) {
    next(error);
  }
});

// Verify token endpoint
router.get('/verify', (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    res.json({ 
      success: true,
      data: {
        valid: true, 
        user: { username: decoded.username, role: decoded.role }
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
