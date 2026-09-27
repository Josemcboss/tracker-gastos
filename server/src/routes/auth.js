const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const auth = require('../middleware/auth');
const securityLogger = require('../utils/securityLogger');
const {
  validateRegister,
  validateLogin,
  validateChangePassword,
} = require('../middleware/validate');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'tracker_gastos_jwt_secret_key_2026_prod';
const TOKEN_EXPIRY = '7d'; // OWASP A07: Reasonable session validity window

/** Default categories created for every new user */
const DEFAULT_CATEGORIES = [
  { name: 'Comida',           color: '#8B5CF6', icon: 'utensils' },
  { name: 'Transporte',       color: '#A78BFA', icon: 'car' },
  { name: 'Vivienda',         color: '#C4B5FD', icon: 'home' },
  { name: 'Entretenimiento',  color: '#D946EF', icon: 'gamepad-2' },
  { name: 'Salud',            color: '#F472B6', icon: 'heart-pulse' },
  { name: 'Educación',        color: '#6D28D9', icon: 'graduation-cap' },
  { name: 'Otros',            color: '#52525B', icon: 'ellipsis' },
];

// ─── Register ────────────────────────────────────────────────────────
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      securityLogger.warn('AUTH_REGISTER_EMAIL_EXISTS', { ip: req.ip, email });
      return res.status(400).json({ error: 'Este correo electrónico ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        categories: {
          create: DEFAULT_CATEGORIES.map(cat => ({ ...cat, isDefault: true })),
        },
      },
    });

    securityLogger.info('AUTH_REGISTER_SUCCESS', { ip: req.ip, userId: user.id, email });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    securityLogger.error('AUTH_REGISTER_ERROR', { ip: req.ip, message: error.message });
    res.status(500).json({ error: 'Error al registrar usuario.' });
  }
});

// ─── Login ───────────────────────────────────────────────────────────
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      securityLogger.warn('AUTH_LOGIN_FAILED_NO_USER', { ip: req.ip, email });
      // Generic message to mitigate user enumeration (OWASP A04/A07)
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      securityLogger.warn('AUTH_LOGIN_FAILED_BAD_PASSWORD', { ip: req.ip, email });
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    securityLogger.info('AUTH_LOGIN_SUCCESS', { ip: req.ip, userId: user.id, email });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    securityLogger.error('AUTH_LOGIN_ERROR', { ip: req.ip, message: error.message });
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// ─── Get current user ────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json(user);
  } catch (error) {
    securityLogger.error('AUTH_GET_ME_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error del servidor.' });
  }
});

// ─── Change Password ────────────────────────────────────────────────
router.post('/change-password', auth, validateChangePassword, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      securityLogger.warn('AUTH_CHANGE_PASSWORD_BAD_CURRENT', {
        ip: req.ip,
        userId: req.userId,
      });
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    securityLogger.info('AUTH_CHANGE_PASSWORD_SUCCESS', {
      ip: req.ip,
      userId: req.userId,
    });

    res.json({ message: 'Contraseña actualizada exitosamente.' });
  } catch (error) {
    securityLogger.error('AUTH_CHANGE_PASSWORD_ERROR', {
      ip: req.ip,
      userId: req.userId,
      message: error.message,
    });
    res.status(500).json({ error: 'Error al actualizar contraseña.' });
  }
});

module.exports = router;
