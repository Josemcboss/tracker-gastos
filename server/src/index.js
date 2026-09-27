require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');
const securityLogger = require('./utils/securityLogger');

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const categoryRoutes = require('./routes/categories');
const dashboardRoutes = require('./routes/dashboard');
const integrationRoutes = require('./routes/integrations');

const app = express();

// OWASP A05: Disable fingerprinting headers
app.disable('x-powered-by');

// Trust reverse proxy (Render, Vercel, Cloudflare) for accurate IP detection
app.set('trust proxy', 1);

// OWASP A01: Strict CORS configuration
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

// In development, also ensure localhost default is available
if (process.env.NODE_ENV !== 'production' && !allowedOrigins.includes('http://localhost:5173')) {
  allowedOrigins.push('http://localhost:5173');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow tools, health-checks or same-origin without origin header
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(cleanOrigin) || (process.env.NODE_ENV !== 'production' && cleanOrigin.includes('localhost'))) {
      return callback(null, true);
    }
    securityLogger.warn('CORS_ORIGIN_REJECTED', { origin });
    return callback(new Error('Bloqueado por política CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours preflight cache
}));

// OWASP A05: Hardened HTTP Headers with Helmet & CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", ...allowedOrigins],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// OWASP A03 / A04: Limit request payload to prevent memory exhaustion and DoS
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// Health check (placed before rate limiter so monitoring probes aren't rate limited)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rate limiters
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/change-password', authLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/incomes', require('./routes/incomes'));
app.use('/api/income-categories', require('./routes/incomeCategories'));
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/integrations', integrationRoutes);

// Global error handler (OWASP A05: Prevents sensitive error / stack leakage)
app.use((err, req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El tamaño de los datos enviados excede el límite permitido.' });
  }

  if (err.message === 'Bloqueado por política CORS') {
    return res.status(403).json({ error: 'Acceso denegado por política de origen cruzado (CORS).' });
  }

  securityLogger.error('UNHANDLED_EXCEPTION', {
    ip: req.ip,
    path: req.originalUrl,
    method: req.method,
    message: err.message,
  });

  res.status(500).json({ error: 'Error interno del servidor. Por favor intenta más tarde.' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
