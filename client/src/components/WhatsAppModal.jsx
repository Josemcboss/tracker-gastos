import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Smartphone, Wifi, WifiOff, QrCode, MessageCircle, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import './WhatsAppModal.css';

export default function WhatsAppModal({ isOpen, onClose }) {
  const [status, setStatus] = useState('loading'); // loading | disconnected | connecting | waiting_scan | connected | error
  const [qrCode, setQrCode] = useState(null);
  const [connectedPhone, setConnectedPhone] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const [connectedSince, setConnectedSince] = useState(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.request('/whatsapp/status');
      setStatus(data.status);
      setQrCode(data.qrCode || null);
      setConnectedPhone(data.connectedPhone || null);
      setMessageCount(data.messageCount || 0);
      setConnectedSince(data.connectedSince || null);
      setError('');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Error de conexión');
    }
  }, []);

  // Poll for status/QR updates when connecting or waiting for scan
  useEffect(() => {
    if (!isOpen) return;

    fetchStatus();

    // Poll every 2.5 seconds while waiting for QR or connecting
    pollRef.current = setInterval(() => {
      fetchStatus();
    }, 2500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isOpen, fetchStatus]);

  // Stop polling once connected
  useEffect(() => {
    if (status === 'connected' || status === 'disconnected' || status === 'error') {
      // Reduce polling to every 10s when connected or idle
      if (pollRef.current) clearInterval(pollRef.current);
      if (isOpen && status === 'connected') {
        pollRef.current = setInterval(fetchStatus, 10000);
      }
    }
  }, [status, isOpen, fetchStatus]);

  const handleConnect = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.request('/whatsapp/connect', { method: 'POST' });
      // Start polling for QR
      setStatus('connecting');
    } catch (err) {
      setError(err.message || 'Error al conectar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async (clearSession = false) => {
    setActionLoading(true);
    try {
      await api.request('/whatsapp/disconnect', {
        method: 'POST',
        body: JSON.stringify({ clearSession }),
      });
      setStatus('disconnected');
      setQrCode(null);
      setConnectedPhone(null);
    } catch (err) {
      setError(err.message || 'Error al desconectar');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay whatsapp-overlay" onClick={onClose}>
      <div className="modal-content whatsapp-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header whatsapp-modal-header">
          <div className="whatsapp-header-title">
            <div className="whatsapp-icon-circle">
              <MessageCircle size={22} />
            </div>
            <div>
              <h3>Bot de WhatsApp</h3>
              <p className="whatsapp-subtitle">Registra gastos por mensaje</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="whatsapp-modal-body">
          {/* ── Loading State ── */}
          {status === 'loading' && (
            <div className="whatsapp-state-box">
              <Loader2 size={40} className="spin whatsapp-loader" />
              <p>Verificando estado de conexión...</p>
            </div>
          )}

          {/* ── Disconnected State ── */}
          {status === 'disconnected' && (
            <div className="whatsapp-state-box">
              <div className="whatsapp-disconnected-icon">
                <WifiOff size={48} />
              </div>
              <h4>WhatsApp no está conectado</h4>
              <p className="whatsapp-desc">
                Conecta tu número de WhatsApp escaneando un código QR.
                Podrás registrar gastos enviándote mensajes a ti mismo.
              </p>

              <button
                className="whatsapp-connect-btn"
                onClick={handleConnect}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>Iniciando...</span>
                  </>
                ) : (
                  <>
                    <QrCode size={18} />
                    <span>Conectar WhatsApp</span>
                  </>
                )}
              </button>

              <div className="whatsapp-instructions">
                <h5>📱 ¿Cómo funciona?</h5>
                <ol>
                  <li>Haz clic en <strong>"Conectar WhatsApp"</strong></li>
                  <li>Escanea el código QR con tu teléfono</li>
                  <li>Abre el chat <strong>"Tú mismo"</strong> en WhatsApp</li>
                  <li>Escribe: <code>Almuerzo 450</code></li>
                  <li>¡El gasto se registra al instante! ✅</li>
                </ol>
              </div>
            </div>
          )}

          {/* ── Connecting / Waiting for QR ── */}
          {(status === 'connecting' || status === 'waiting_scan') && (
            <div className="whatsapp-state-box">
              {qrCode ? (
                <>
                  <div className="whatsapp-qr-container">
                    <img
                      src={qrCode}
                      alt="WhatsApp QR Code"
                      className="whatsapp-qr-image"
                    />
                    <div className="whatsapp-qr-glow" />
                  </div>
                  <h4>Escanea este código QR</h4>
                  <p className="whatsapp-desc">
                    Abre WhatsApp en tu teléfono → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong> → Apunta la cámara aquí
                  </p>
                  <div className="whatsapp-qr-hint">
                    <RefreshCw size={14} />
                    <span>El código se actualiza automáticamente</span>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 size={44} className="spin whatsapp-loader" />
                  <h4>Generando código QR...</h4>
                  <p className="whatsapp-desc">Espera un momento mientras se establece la conexión.</p>
                </>
              )}
            </div>
          )}

          {/* ── Connected State ── */}
          {status === 'connected' && (
            <div className="whatsapp-state-box">
              <div className="whatsapp-connected-icon">
                <CheckCircle2 size={48} />
                <div className="whatsapp-pulse-ring" />
              </div>
              <h4>¡WhatsApp Conectado!</h4>

              <div className="whatsapp-connected-info">
                <div className="whatsapp-info-row">
                  <Smartphone size={16} />
                  <span>Número: <strong>+{connectedPhone}</strong></span>
                </div>
                <div className="whatsapp-info-row">
                  <Wifi size={16} />
                  <span>Estado: <strong className="text-green">Activo</strong></span>
                </div>
                <div className="whatsapp-info-row">
                  <MessageCircle size={16} />
                  <span>Gastos registrados: <strong>{messageCount}</strong></span>
                </div>
                {connectedSince && (
                  <div className="whatsapp-info-row">
                    <RefreshCw size={16} />
                    <span>Conectado: <strong>{new Date(connectedSince).toLocaleString('es-DO')}</strong></span>
                  </div>
                )}
              </div>

              <div className="whatsapp-usage-box">
                <h5>💬 Envía un mensaje a "Tú mismo" con:</h5>
                <div className="whatsapp-example-messages">
                  <div className="wa-msg-bubble">Almuerzo 450</div>
                  <div className="wa-msg-bubble">Uber 320</div>
                  <div className="wa-msg-bubble">Gasolina 2500</div>
                  <div className="wa-msg-bubble">RD$ 1200 Supermercado</div>
                </div>
              </div>

              <button
                className="whatsapp-disconnect-btn"
                onClick={() => handleDisconnect(true)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Desconectando...</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={16} />
                    <span>Desconectar WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Error State ── */}
          {status === 'error' && (
            <div className="whatsapp-state-box">
              <div className="whatsapp-error-icon">
                <AlertTriangle size={48} />
              </div>
              <h4>Error de Conexión</h4>
              <p className="whatsapp-desc">{error || 'No se pudo conectar a WhatsApp.'}</p>
              <button
                className="whatsapp-connect-btn"
                onClick={handleConnect}
                disabled={actionLoading}
              >
                <RefreshCw size={18} />
                <span>Reintentar</span>
              </button>
            </div>
          )}

          {/* Persistent error banner */}
          {error && status !== 'error' && (
            <div className="whatsapp-error-banner">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
