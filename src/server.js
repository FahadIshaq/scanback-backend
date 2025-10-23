const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins for debugging
  credentials: true
}));

// Enhanced rate limiting for better concurrent handling
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased limit for better concurrent handling
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests to not penalize good users
  skipSuccessfulRequests: true
});

// Separate rate limiting for QR code requests (more permissive)
const qrLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Allow more QR code requests
  message: 'Too many QR code requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);
app.use('/api/qr/', qrLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Keep-alive middleware for better performance
app.use((req, res, next) => {
  res.set('Connection', 'keep-alive');
  res.set('Keep-Alive', 'timeout=5, max=1000');
  next();
});

// MongoDB Atlas connection with AGGRESSIVE optimization for sub-3-second response
const mongoOptions = {
  maxPoolSize: 20, // Increased pool size for better concurrency
  minPoolSize: 5, // Keep more connections alive
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 15000,
  connectTimeoutMS: 5000,
  maxIdleTimeMS: 60000,
  retryWrites: true,
  w: 'majority',
  readPreference: 'primary',
  compressors: ['zlib'],
  zlibCompressionLevel: 1,
  // Additional options for better concurrent handling
  maxConnecting: 10 // Limit concurrent connection attempts
};

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scanback', mongoOptions)
.then(async () => {
  console.log('✅ MongoDB connected successfully');
  console.log('📊 Connection pool size:', mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected');
  
  // Initialize QR cache with popular codes
  try {
    const QRService = require('./services/qrService');
    await QRService.initializeCache();
  } catch (error) {
    console.log('⚠️ Cache initialization failed:', error.message);
  }
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/items', require('./routes/items'));
app.use('/api/pets', require('./routes/pets'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
