/*const express = require('express');
const router = express.Router();
const { register, login, verifyEmail, getProfile, devVerify } = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.post('/verify-email', verifyEmail);
router.post('/dev-verify', devVerify); // Development verification bypass

// Protected routes
router.get('/profile', authenticate, getProfile);

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;*/
const express = require('express');
const router = express.Router();
const { register, login, verifyEmail, getProfile } = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.post('/verify-email', verifyEmail);

// Protected routes
router.get('/profile', authenticate, getProfile);

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
