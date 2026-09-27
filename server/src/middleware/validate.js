/**
 * Validation & Sanitization Middleware
 * Enforces OWASP A01 (Broken Access Control - UUID verification),
 * A03 (Injection - Input sanitization & typing),
 * and A08 (Software and Data Integrity - Range & format validation).
 */

const securityLogger = require('../utils/securityLogger');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Strip potentially dangerous HTML / script characters from strings to prevent stored XSS.
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '') // strip < and >
    .trim();
};

/**
 * Validates that an ID in req.params is a valid UUID
 */
const validateUUIDParam = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  if (!id || !UUID_REGEX.test(id)) {
    securityLogger.warn('INVALID_UUID_PARAMETER', {
      ip: req.ip,
      paramName,
      value: id,
      path: req.originalUrl,
    });
    return res.status(400).json({ error: `Identificador '${paramName}' inválido.` });
  }
  next();
};

/**
 * Validates Registration payload
 */
const validateRegister = (req, res, next) => {
  let { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, contraseña y nombre son requeridos.' });
  }

  email = sanitizeString(email).toLowerCase();
  name = sanitizeString(name);

  if (!EMAIL_REGEX.test(email) || email.length > 255) {
    return res.status(400).json({ error: 'Formato de correo electrónico no válido.' });
  }

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 100 caracteres.' });
  }

  // OWASP Password complexity: minimum 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: 'La contraseña debe incluir al menos una letra mayúscula.' });
  }
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ error: 'La contraseña debe incluir al menos una letra minúscula.' });
  }
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'La contraseña debe incluir al menos un número.' });
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return res.status(400).json({ error: 'La contraseña debe incluir al menos un carácter especial (@, $, !, %, etc.).' });
  }

  req.body.email = email;
  req.body.name = name;
  next();
};

/**
 * Validates Login payload
 */
const validateLogin = (req, res, next) => {
  let { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Formato de credenciales inválido.' });
  }

  req.body.email = sanitizeString(email).toLowerCase();
  next();
};

/**
 * Validates Password Change payload
 */
const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'La contraseña actual y la nueva contraseña son requeridas.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  if (!/[A-Z]/.test(newPassword)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos una mayúscula.' });
  }
  if (!/[a-z]/.test(newPassword)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos una minúscula.' });
  }
  if (!/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos un número.' });
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos un carácter especial.' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'La nueva contraseña no puede ser idéntica a la anterior.' });
  }

  next();
};

/**
 * Validates Expense payload
 */
const validateExpense = (isUpdate = false) => (req, res, next) => {
  const { amount, description, date, categoryId, paymentMethod } = req.body;

  if (!isUpdate) {
    if (amount === undefined || !description || !date || !categoryId) {
      return res.status(400).json({ error: 'Monto, descripción, fecha y categoría son requeridos.' });
    }
  }

  if (amount !== undefined) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'El monto debe ser un número positivo mayor a 0.' });
    }
    if (numAmount > 100000000) {
      return res.status(400).json({ error: 'El monto excede el límite permitido.' });
    }
    req.body.amount = Math.round(numAmount * 100) / 100;
  }

  if (description !== undefined) {
    const sanitizedDesc = sanitizeString(description);
    if (sanitizedDesc.length === 0 || sanitizedDesc.length > 255) {
      return res.status(400).json({ error: 'La descripción debe tener entre 1 y 255 caracteres.' });
    }
    req.body.description = sanitizedDesc;
  }

  if (date !== undefined) {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida.' });
    }
    // Limit date to realistic range
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 2);
    if (parsedDate < new Date('1990-01-01') || parsedDate > maxFutureDate) {
      return res.status(400).json({ error: 'La fecha está fuera de los rangos válidos.' });
    }
  }

  if (categoryId !== undefined) {
    if (!UUID_REGEX.test(categoryId)) {
      return res.status(400).json({ error: 'Identificador de categoría inválido.' });
    }
  }

  if (paymentMethod !== undefined && paymentMethod !== null) {
    req.body.paymentMethod = sanitizeString(paymentMethod).slice(0, 50);
  }

  next();
};

/**
 * Validates Category payload
 */
const validateCategory = (isUpdate = false) => (req, res, next) => {
  const { name, color, icon } = req.body;

  if (!isUpdate) {
    if (!name || !color) {
      return res.status(400).json({ error: 'Nombre y color son requeridos.' });
    }
  }

  if (name !== undefined) {
    const cleanName = sanitizeString(name);
    if (cleanName.length < 1 || cleanName.length > 50) {
      return res.status(400).json({ error: 'El nombre de la categoría debe tener entre 1 y 50 caracteres.' });
    }
    req.body.name = cleanName;
  }

  if (color !== undefined) {
    if (!HEX_COLOR_REGEX.test(color)) {
      return res.status(400).json({ error: 'Formato de color inválido. Use formato hexadecimal (#RGB o #RRGGBB).' });
    }
  }

  if (icon !== undefined) {
    req.body.icon = sanitizeString(icon).slice(0, 40);
  }

  next();
};

module.exports = {
  sanitizeString,
  validateUUIDParam,
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateExpense,
  validateCategory,
};
