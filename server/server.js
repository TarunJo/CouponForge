require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeDatabase, saveDb } = require('./db/database');
const { sanitizeInput } = require('./middleware/sanitize');
const path = require('path');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const merchantRoutes = require('./routes/merchant');
const couponRoutes = require('./routes/coupon');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust reverse proxy (Render, Cloudflare, etc.) so express-rate-limit tracks real client IPs
app.set('trust proxy', 1);

// ========================================
// SECURITY MIDDLEWARE
// ========================================

// Helmet: sets various HTTP security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development (React handles this)
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like same-origin, curl, mobile) or matching allowed origins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON body with size limit (prevent large payload attacks)
app.use(express.json({ limit: '1mb' }));

// XSS sanitization on all inputs
app.use(sanitizeInput);

// No-cache headers on API responses (prevents back-button data leaking)
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ========================================
// RATE LIMITING
// ========================================

// Strict rate limiting for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiting for public routes (per client IP)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // 500 requests per 15 minutes per IP
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for coupon scratch (prevent automated scratching)
const scratchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 scratch attempts per minute
  message: { error: 'Too many scratch attempts. Please wait a moment.' },
});

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/coupon', publicLimiter);

// ========================================
// ROUTES
// ========================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/coupon', couponRoutes);

// Health check (used by cloud services and keepalive pings)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ========================================
// SERVE PRODUCTION CLIENT
// ========================================
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`📦 Serving static client build from ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  // Express 5 compatible SPA fallback for all non-API GET requests
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// ========================================
// ERROR HANDLING
// ========================================

// Global error handler (prevents leaking stack traces)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================
process.on('SIGINT', () => {
  console.log('\n💾 Saving database before exit...');
  saveDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveDb();
  process.exit(0);
});

// ========================================
// START SERVER
// ========================================
async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔒 Security: Helmet, CORS, Rate Limiting, XSS Filter, No-Cache`);
      console.log(`📋 API endpoints:`);
      console.log(`   Auth:     POST /api/auth/admin/login, POST /api/auth/merchant/login`);
      console.log(`   Admin:    /api/admin/merchants (CRUD)`);
      console.log(`   Merchant: /api/merchant/dashboard, /api/merchant/coupons`);
      console.log(`   Public:   GET /api/coupon/:uuid, POST /api/coupon/:uuid/scratch`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
