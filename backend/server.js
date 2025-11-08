const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const institutionRoutes = require('./routes/institutions');
const companyRoutes = require('./routes/companies');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Home route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Career Guidance Platform API',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      auth: '/api/auth',
      students: '/api/students',
      institutions: '/api/institutions', 
      companies: '/api/companies',
      admin: '/api/admin',
      public: '/api/public'
    }
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Handle undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('🚀 Career Platform Backend Server Started');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}`);
  console.log(`🏠 Home: http://localhost:${PORT}/`);
  console.log(`❤️ Health: http://localhost:${PORT}/health`);
  console.log('\n📚 Available API Endpoints:');
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
  console.log(`🎓 Students: http://localhost:${PORT}/api/students`);
  console.log(`🏫 Institutions: http://localhost:${PORT}/api/institutions`);
  console.log(`💼 Companies: http://localhost:${PORT}/api/companies`);
  console.log(`⚙️ Admin: http://localhost:${PORT}/api/admin`);
  console.log(`🌍 Public: http://localhost:${PORT}/api/public`);
});