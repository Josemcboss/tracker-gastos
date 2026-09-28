/**
 * WhatsApp Bot Service - Baileys (QR Code Session)
 * Connects to WhatsApp Web via QR scan and processes expense messages.
 *
 * Flow:
 *  1. User clicks "Connect WhatsApp" in the app
 *  2. Server starts Baileys, generates a QR code
 *  3. User scans QR with their phone → session is established
 *  4. User sends a message to themselves ("Message Yourself") like "Almuerzo 450"
 *  5. Bot parses amount + description, auto-categorizes, saves to DB
 *  6. Bot replies with a confirmation
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const prisma = require('../db');
const { findBestCategory } = require('../utils/autoCategorize');

class WhatsAppBot {
  constructor() {
    this.socket = null;
    this.qrCode = null;        // base64 data URL of the QR
    this.status = 'disconnected'; // disconnected | connecting | waiting_scan | connected
    this.connectedUserId = null;
    this.connectedPhone = null;
    this.connectionStartTime = null;
    this.messageCount = 0;
    this.authDir = path.join(__dirname, '../../whatsapp_auth');
    this._reconnecting = false;
    this._initialSync = true; // Flag to ignore historical messages on first connect
  }

  /**
   * Returns a serializable snapshot of the current state
   */
  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCode,
      connectedPhone: this.connectedPhone,
      connectedSince: this.connectionStartTime,
      messageCount: this.messageCount,
    };
  }

  /**
   * Start a new WhatsApp Web connection for the given userId
   */
  async connect(userId) {
    if (this.status === 'connected') {
      return { status: 'already_connected', phone: this.connectedPhone };
    }

    // Prevent duplicate connection attempts
    if (this.status === 'connecting' || this.status === 'waiting_scan') {
      return { status: this.status, qrCode: this.qrCode };
    }

    this.connectedUserId = userId;
    this.status = 'connecting';
    this.qrCode = null;
    this._initialSync = true;

    // Ensure auth directory exists
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version } = await fetchLatestBaileysVersion();

      this.socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Tracker de Gastos', 'Chrome', '10.0'],
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
      });

      // ── Connection updates (QR, open, close) ──
      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCode = await QRCode.toDataURL(qr, {
              width: 280,
              margin: 2,
              color: { dark: '#ffffffdd', light: '#00000000' },
            });
            this.status = 'waiting_scan';
            console.log('[WhatsApp] QR code generated - waiting for scan...');
          } catch (err) {
            console.error('[WhatsApp] QR generation error:', err.message);
          }
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrCode = null;
          this.connectionStartTime = new Date().toISOString();
          this.connectedPhone = this.socket.user?.id?.split(':')[0] || 'unknown';
          this._initialSync = true;

          // Mark initial sync complete after a delay (ignore old messages)
          setTimeout(() => {
            this._initialSync = false;
            console.log('[WhatsApp] Ready to process new messages.');
          }, 8000);

          console.log(`[WhatsApp] ✅ Connected as +${this.connectedPhone}`);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`[WhatsApp] Connection closed. Code: ${statusCode}. Reconnect: ${shouldReconnect}`);

          if (shouldReconnect && !this._reconnecting) {
            this._reconnecting = true;
            // Auto-reconnect after 3 seconds
            setTimeout(() => {
              this._reconnecting = false;
              this.status = 'disconnected';
              this.connect(this.connectedUserId);
            }, 3000);
          } else {
            this.status = 'disconnected';
            this.qrCode = null;
            this.connectedPhone = null;
            this.connectionStartTime = null;
          }
        }
      });

      // ── Persist credentials ──
      this.socket.ev.on('creds.update', saveCreds);

      // ── Handle incoming messages ──
      this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
        // Only process real-time "notify" messages (not historical syncs)
        if (type !== 'notify') return;
        if (this._initialSync) return;

        for (const msg of messages) {
          await this._handleMessage(msg);
        }
      });

      return { status: 'connecting' };
    } catch (err) {
      console.error('[WhatsApp] Connection error:', err.message);
      this.status = 'disconnected';
      throw err;
    }
  }

  /**
   * Disconnect and optionally clear the stored session
   */
  async disconnect(clearSession = false) {
    try {
      if (this.socket) {
        await this.socket.logout();
        this.socket = null;
      }
    } catch {
      // Socket may already be closed
      this.socket = null;
    }

    this.status = 'disconnected';
    this.qrCode = null;
    this.connectedPhone = null;
    this.connectionStartTime = null;

    if (clearSession) {
      // Remove stored auth files so next connect requires a new QR scan
      try {
        if (fs.existsSync(this.authDir)) {
          fs.rmSync(this.authDir, { recursive: true, force: true });
          console.log('[WhatsApp] Session cleared.');
        }
      } catch (err) {
        console.error('[WhatsApp] Error clearing session:', err.message);
      }
    }

    return { status: 'disconnected' };
  }

  /**
   * Process an incoming WhatsApp message
   */
  async _handleMessage(msg) {
    try {
      // Extract text from the message
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      if (!text || !this.connectedUserId) return;

      // Get the remote JID (who sent / where it was sent)
      const remoteJid = msg.key.remoteJid || '';

      // We process:
      // 1. Self-chat messages (user messaging themselves)
      // 2. Any message starting with a command prefix (#, /gasto, $)
      const ownJid = this.socket?.user?.id || '';
      const ownPhone = ownJid.split(':')[0];
      const senderPhone = remoteJid.split('@')[0];
      const isSelfChat = senderPhone === ownPhone;
      const hasPrefix = /^[#$\/]/.test(text.trim());

      // Only process self-chat or prefixed messages
      if (!isSelfChat && !hasPrefix) return;

      // Strip the prefix if present
      let cleanText = text.trim();
      if (/^[#$]/.test(cleanText)) {
        cleanText = cleanText.slice(1).trim();
      } else if (cleanText.toLowerCase().startsWith('/gasto')) {
        cleanText = cleanText.slice(6).trim();
      }

      // ── Parse the expense from text ──
      // Supported formats: "Almuerzo 450", "450 Almuerzo", "Uber 350.50", "RD$ 2000 Gasolina"
      const amountMatch = cleanText.match(
        /(?:RD\$|DOP|\$)?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i
      );

      if (!amountMatch) {
        // Send help message if no amount detected
        await this._reply(remoteJid, msg, [
          '🤔 No detecté un monto en tu mensaje.',
          '',
          '📝 *Formatos válidos:*',
          '• Almuerzo 450',
          '• 2000 Gasolina',
          '• Uber 350.50',
          '• RD$ 1500 Supermercado',
          '',
          '💡 Envía tus gastos desde este chat (Mensajes a ti mismo).',
        ].join('\n'));
        return;
      }

      const rawNum = amountMatch[1].replace(',', '.');
      const parsedAmount = parseFloat(rawNum);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        await this._reply(remoteJid, msg, '⚠️ El monto debe ser un número mayor a cero.');
        return;
      }

      // Extract description (everything except the number and currency words)
      let description = cleanText
        .replace(amountMatch[0], '')
        .replace(/\b(rd\$|dop|pesos|dolares|usd|\$)\b/gi, '')
        .trim();

      if (!description) description = 'Gasto por WhatsApp';

      // ── Fetch user categories and auto-categorize ──
      const user = await prisma.user.findUnique({
        where: { id: this.connectedUserId },
        include: { categories: true },
      });

      if (!user || !user.categories.length) {
        await this._reply(remoteJid, msg, '⚠️ No se encontraron categorías. Crea al menos una en la app.');
        return;
      }

      const targetCategory = findBestCategory(description, user.categories);

      // ── Save expense to DB ──
      const expense = await prisma.expense.create({
        data: {
          amount: Math.round(parsedAmount * 100) / 100,
          description,
          date: new Date(),
          paymentMethod: 'WhatsApp Bot',
          currency: 'DOP',
          exchangeRate: 1,
          userId: user.id,
          categoryId: targetCategory.id,
        },
      });

      this.messageCount++;

      // ── Send confirmation ──
      const formattedAmount = expense.amount.toLocaleString('es-DO', {
        minimumFractionDigits: 2,
      });

      await this._reply(remoteJid, msg, [
        '✅ *¡Gasto registrado!*',
        '',
        `💵 *Monto:* RD$ ${formattedAmount}`,
        `📌 *Concepto:* ${expense.description}`,
        `🏷️ *Categoría:* ${targetCategory.name}`,
        `📅 *Fecha:* ${new Date().toLocaleDateString('es-DO')}`,
        '',
        `📊 _Gastos registrados por WhatsApp: ${this.messageCount}_`,
      ].join('\n'));

      console.log(`[WhatsApp] Expense saved: RD$ ${formattedAmount} - ${description} → ${targetCategory.name}`);
    } catch (err) {
      console.error('[WhatsApp] Message handler error:', err.message);
    }
  }

  /**
   * Helper: send a reply message
   */
  async _reply(jid, quotedMsg, text) {
    try {
      if (!this.socket) return;
      await this.socket.sendMessage(jid, { text }, { quoted: quotedMsg });
    } catch (err) {
      console.error('[WhatsApp] Reply error:', err.message);
    }
  }
}

// Singleton instance
const whatsappBot = new WhatsAppBot();

module.exports = whatsappBot;
