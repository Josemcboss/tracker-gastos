const jwt = require('jsonwebtoken');
const securityLogger = require('../utils/securityLogger');

const JWT_SECRET = process.env.JWT_SECRET || 'tracker_gastos_jwt_secret_key_2026_prod';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('CRITICAL SECURITY ERROR: JWT_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

/**
 * OWASP A01 & A07: Broken Access Control & Auth Middleware
 * Extracts token from Bearer header, validates integrity & signature, and attaches userId.
 */
const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Acceso no autorizado. Token requerido.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token con formato inválido.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    securityLogger.warn('INVALID_TOKEN_ATTEMPT', {
      ip: req.ip,
      path: req.originalUrl,
      reason: error.message,
    });
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};

module.exports = auth;
