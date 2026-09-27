const rateLimit = require('express-rate-limit');
const securityLogger = require('../utils/securityLogger');

/**
 * OWASP A04: Insecure Design & Brute-force Mitigation
 * Strict rate limiter for sensitive authentication endpoints (login, register, change-password).
 * Restricts to 10 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    securityLogger.warn('AUTH_RATE_LIMIT_TRIGGERED', {
      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
      email: req.body?.email,
    });
    res.status(options.statusCode).json({
      error: 'Demasiados intentos de autenticación desde esta IP. Por favor espera 15 minutos antes de intentar de nuevo.',
    });
  },
});

/**
 * General API rate limiter for DDoS and scraping mitigation.
 * Restricts to 200 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    securityLogger.warn('API_RATE_LIMIT_TRIGGERED', {
      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
    });
    res.status(options.statusCode).json({
      error: 'Límite de solicitudes a la API excedido. Por favor intenta más tarde.',
    });
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
};
