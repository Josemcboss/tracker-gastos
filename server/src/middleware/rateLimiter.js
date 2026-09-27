const rateLimit = require('express-rate-limit');

/**
 * Auth rate limiter for login and registration.
 * Restricts to 10 attempts per 15 minutes per IP to block brute-force and DDoS.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 solicitudes por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos desde esta IP. Por favor espera 15 minutos antes de intentar de nuevo.',
  },
});

/**
 * General API rate limiter for DDoS and abusive scraping protection.
 * Restricts to 200 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // máximo 200 solicitudes por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Límite de solicitudes a la API excedido. Por favor intenta más tarde.',
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
};
