/**
 * Security Event Logger for OWASP A09 (Security Logging and Monitoring Failures)
 * Logs security-relevant incidents with timestamps, client IP, event types,
 * while strictly masking sensitive data (passwords, tokens, personal identifiers).
 */

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
  return `${maskedName}@${domain}`;
};

const formatLog = (level, event, meta = {}) => {
  const timestamp = new Date().toISOString();
  const safeMeta = { ...meta };
  if (safeMeta.email) safeMeta.email = maskEmail(safeMeta.email);
  delete safeMeta.password;
  delete safeMeta.currentPassword;
  delete safeMeta.newPassword;
  delete safeMeta.token;

  return JSON.stringify({
    timestamp,
    level,
    event,
    ...safeMeta,
  });
};

const securityLogger = {
  info(event, meta = {}) {
    console.log(`[SECURITY-INFO] ${formatLog('INFO', event, meta)}`);
  },
  warn(event, meta = {}) {
    console.warn(`[SECURITY-WARN] ${formatLog('WARN', event, meta)}`);
  },
  error(event, meta = {}) {
    console.error(`[SECURITY-ERROR] ${formatLog('ERROR', event, meta)}`);
  },
};

module.exports = securityLogger;
