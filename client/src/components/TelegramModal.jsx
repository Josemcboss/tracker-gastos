import { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, Copy, ExternalLink, RefreshCw, MessageSquare, Sparkles } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './TelegramModal.css';

export default function TelegramModal({ isOpen, onClose }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getTelegramStatus();
      setData(res);
    } catch (err) {
      showToast(err.message || 'Error al obtener estado de Telegram', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('¿Seguro que deseas desvincular tu cuenta de Telegram?')) return;
    setUnlinking(true);
    try {
      await api.unlinkTelegram();
      showToast('Telegram desvinculado');
      loadStatus();
    } catch (err) {
      showToast(err.message || 'Error al desvincular', 'error');
    } finally {
      setUnlinking(false);
    }
  };

  const handleCopyLink = () => {
    if (data?.botUrl) {
      navigator.clipboard.writeText(data.botUrl);
      showToast('Enlace copiado al portapapeles');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-sheet telegram-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-header">
          <div className="telegram-title-wrap">
            <div className="telegram-icon-badge">
              <Send size={20} color="#fff" />
            </div>
            <div>
              <h2>Bot de Telegram</h2>
              <span className="telegram-subtitle">Registro ultra-rápido por chat</span>
            </div>
          </div>
          <button className="form-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="telegram-loading">
            <RefreshCw size={24} className="spin-icon text-purple" />
            <p>Verificando conexión con Telegram...</p>
          </div>
        ) : (
          <div className="telegram-content">
            {/* Status indicator */}
            <div className={`telegram-status-bar ${data?.isLinked ? 'connected' : 'disconnected'}`}>
              <div className="status-dot" />
              <span>
                {data?.isLinked
                  ? 'Cuenta conectada y lista para recibir gastos'
                  : 'Aún no has conectado tu cuenta de Telegram'}
              </span>
              {data?.isLinked && (
                <button
                  type="button"
                  className="btn-telegram-unlink"
                  onClick={handleUnlink}
                  disabled={unlinking}
                >
                  {unlinking ? 'Desvinculando...' : 'Desconectar'}
                </button>
              )}
            </div>

            {/* Action button */}
            <div className="telegram-action-box">
              <a
                href={data?.botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-telegram-connect"
              >
                <Send size={18} />
                <span>{data?.isLinked ? 'Abrir Chat con el Bot' : 'Conectar con Telegram Ahora'}</span>
                <ExternalLink size={16} />
              </a>

              <button type="button" className="btn-telegram-copy" onClick={handleCopyLink}>
                <Copy size={14} />
                <span>Copiar Enlace Directo</span>
              </button>
            </div>

            {/* Instructions */}
            <div className="telegram-instructions">
              <h3>Cómo funciona en 3 pasos:</h3>
              <ol className="telegram-steps">
                <li>
                  <span className="step-num">1</span>
                  <div>
                    <strong>Abre el bot:</strong> Toca el botón de arriba para abrir <code>@{data?.botUsername}</code> en Telegram.
                  </div>
                </li>
                <li>
                  <span className="step-num">2</span>
                  <div>
                    <strong>Toca Iniciar:</strong> Presiona el botón <em>Iniciar</em> (o escribe <code>/start</code>) para vincular tu cuenta con 1 toque.
                  </div>
                </li>
                <li>
                  <span className="step-num">3</span>
                  <div>
                    <strong>¡Escríbele tus gastos!:</strong> Envíale cualquier mensaje de texto cuando compres algo. La IA categorizará el gasto al instante en tu base de datos.
                  </div>
                </li>
              </ol>
            </div>

            {/* Examples card */}
            <div className="telegram-examples-card">
              <div className="examples-header">
                <Sparkles size={16} className="text-purple" />
                <strong>Ejemplos de lo que puedes escribirle:</strong>
              </div>
              <div className="examples-grid">
                <div className="example-bubble">
                  <MessageSquare size={13} />
                  <span>"Almuerzo 450" ➔ <strong>Comida</strong></span>
                </div>
                <div className="example-bubble">
                  <MessageSquare size={13} />
                  <span>"Uber 320" ➔ <strong>Transporte</strong></span>
                </div>
                <div className="example-bubble">
                  <MessageSquare size={13} />
                  <span>"Gasolina 2000" ➔ <strong>Transporte</strong></span>
                </div>
                <div className="example-bubble">
                  <MessageSquare size={13} />
                  <span>"Farmacia Carol 850" ➔ <strong>Salud</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
