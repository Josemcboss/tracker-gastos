/**
 * WhatsApp Bot API Routes
 * Manages WhatsApp connection, QR code generation, and status.
 */

const express = require('express');
const auth = require('../middleware/auth');
const whatsappBot = require('../services/whatsappBot');
const securityLogger = require('../utils/securityLogger');

const router = express.Router();

// ─── Get WhatsApp connection status ────────────────────────────────────
router.get('/status', auth, async (req, res) => {
  try {
    const status = whatsappBot.getStatus();
    res.json({
      ...status,
      isConnected: status.status === 'connected',
      isOwner: whatsappBot.connectedUserId === req.userId,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estado de WhatsApp.' });
  }
});

// ─── Start WhatsApp connection (generates QR) ─────────────────────────
router.post('/connect', auth, async (req, res) => {
  try {
    // Only allow one user to connect at a time
    if (
      whatsappBot.status === 'connected' &&
      whatsappBot.connectedUserId !== req.userId
    ) {
      return res.status(409).json({
        error: 'WhatsApp ya está conectado por otro usuario.',
      });
    }

    const result = await whatsappBot.connect(req.userId);

    securityLogger.info('WHATSAPP_CONNECT_INITIATED', {
      userId: req.userId,
    });

    res.json(result);
  } catch (error) {
    securityLogger.error('WHATSAPP_CONNECT_ERROR', {
      userId: req.userId,
      message: error.message,
    });
    res.status(500).json({ error: 'Error al iniciar conexión WhatsApp.' });
  }
});

// ─── Disconnect WhatsApp ──────────────────────────────────────────────
router.post('/disconnect', auth, async (req, res) => {
  try {
    const clearSession = req.body?.clearSession === true;
    const result = await whatsappBot.disconnect(clearSession);

    securityLogger.info('WHATSAPP_DISCONNECTED', {
      userId: req.userId,
      cleared: clearSession,
    });

    res.json({
      ...result,
      message: clearSession
        ? 'WhatsApp desconectado y sesión eliminada.'
        : 'WhatsApp desconectado.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al desconectar WhatsApp.' });
  }
});

// ─── Get current QR code (for polling from frontend) ──────────────────
router.get('/qr', auth, async (req, res) => {
  try {
    const { status, qrCode } = whatsappBot.getStatus();

    if (status === 'connected') {
      return res.json({ status: 'connected', qrCode: null });
    }

    res.json({
      status,
      qrCode: qrCode || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener código QR.' });
  }
});

module.exports = router;
