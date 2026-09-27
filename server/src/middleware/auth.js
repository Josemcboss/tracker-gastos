const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tracker_gastos_jwt_secret_key_2026_prod';

/**
 * JWT authentication middleware.
 * Extracts the token from the Authorization header (Bearer <token>),
 * verifies it, and attaches req.userId for downstream handlers.
 */
const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = auth;
