import { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Smartphone,
} from 'lucide-react';
import api, { API_BASE } from '../services/api';
import { useToast } from '../context/ToastContext';
import './AppleWalletModal.css';

export default function AppleWalletModal({ isOpen, onClose }) {
  const { showToast } = useToast();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [activeTab, setActiveTab] = useState('guide'); // 'guide' | 'payload'

  const fullBase = API_BASE.startsWith('http')
    ? API_BASE
    : `${window.location.origin}${API_BASE}`;
  const webhookUrl = `${fullBase}/integrations/apple-wallet?token=${token}`;

  useEffect(() => {
    if (!isOpen) return;

    const fetchToken = async () => {
      setLoading(true);
      try {
        const res = await api.getIntegrationToken();
        setToken(res.apiKey);
      } catch (err) {
        showToast(err.message || 'Error al obtener token de integración', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, [isOpen]);

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback below
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  };

  const handleCopy = async (text, type) => {
    const success = await copyToClipboard(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      showToast(success ? '¡URL del Webhook copiada!' : 'Selecciona el texto para copiar');
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
      showToast(success ? '¡Token copiado al portapapeles!' : 'Selecciona el token para copiar');
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('¿Regenerar token? Si ya tienes una automatización en tu iPhone, deberás actualizar la URL con el nuevo token.')) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await api.regenerateIntegrationToken();
      setToken(res.apiKey);
      showToast('Token regenerado exitosamente');
    } catch (err) {
      showToast(err.message || 'Error al regenerar token', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleTestTransaction = async () => {
    setTesting(true);
    try {
      await api.request(`/integrations/apple-wallet?token=${token}`, {
        method: 'POST',
        headers: {
          'x-api-key': token,
        },
        body: JSON.stringify({
          amount: 250.00,
          merchant: 'Starbucks Coffee',
          cardName: 'Apple Pay Visa',
        }),
      });
      showToast('✅ ¡Transacción de prueba registrada exitosamente como Apple Wallet!');
    } catch (err) {
      showToast(err.message || 'Error en prueba', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wallet-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wallet-modal-header">
          <div className="wallet-badge-wrap">
            <div className="wallet-icon-box">
              <CreditCard size={24} className="wallet-main-icon" />
            </div>
            <div>
              <h3>Vincular Apple Wallet</h3>
              <p className="wallet-modal-sub">
                Registra compras de Apple Pay en tiempo real y sin abrir la app
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="wallet-loading">
            <div className="loading-spinner" />
            <p>Generando credenciales de integración seguras...</p>
          </div>
        ) : (
          <div className="wallet-modal-body">
            {/* Webhook Endpoint Box */}
            <div className="webhook-box">
              <div className="webhook-header">
                <span className="webhook-label">Tu URL de Webhook Personal</span>
                <button
                  type="button"
                  className="btn-regenerate"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  title="Regenerar clave de acceso"
                >
                  <RefreshCw size={13} className={regenerating ? 'spin' : ''} />
                  <span>Regenerar</span>
                </button>
              </div>

              <div className="webhook-input-group">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="webhook-url-input"
                  onClick={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className="btn-copy-webhook"
                  onClick={() => handleCopy(webhookUrl, 'url')}
                >
                  {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedUrl ? 'Copiado' : 'Copiar URL'}</span>
                </button>
              </div>
            </div>

            {/* Smart categorization pill */}
            <div className="smart-pill-banner">
              <Sparkles size={16} className="text-purple" />
              <span>
                <strong>Categorización Inteligente Activa:</strong> Clasifica automáticamente Uber, supermercados, restaurantes, farmacias y más.
              </span>
            </div>

            {/* Tabs for instructions */}
            <div className="wallet-tabs">
              <button
                className={`wallet-tab-btn ${activeTab === 'guide' ? 'active' : ''}`}
                onClick={() => setActiveTab('guide')}
              >
                <Smartphone size={16} />
                <span>Configurar en iPhone (1 min)</span>
              </button>
              <button
                className={`wallet-tab-btn ${activeTab === 'payload' ? 'active' : ''}`}
                onClick={() => setActiveTab('payload')}
              >
                <Zap size={16} />
                <span>Estructura JSON</span>
              </button>
            </div>

            {activeTab === 'guide' ? (
              <div className="steps-container">
                <div className="step-card">
                  <div className="step-num">1</div>
                  <div className="step-body">
                    <strong>Abre "Atajos" en tu iPhone</strong>
                    <p>Entra a la app <strong>Atajos</strong> (Shortcuts) y toca la pestaña central <strong>"Automatización"</strong>.</p>
                  </div>
                </div>

                <div className="step-card">
                  <div className="step-num">2</div>
                  <div className="step-body">
                    <strong>Crea una Automatización de Transacción</strong>
                    <p>Toca <strong>"+"</strong> y selecciona <strong>"Transacción"</strong> (al usar Apple Pay). Elige tus tarjetas y marca <strong>"Ejecutar inmediatamente"</strong>.</p>
                  </div>
                </div>

                <div className="step-card">
                  <div className="step-num">3</div>
                  <div className="step-body">
                    <strong>Agrega la acción "Obtener contenido de URL"</strong>
                    <p>
                      - Método: <strong>POST</strong><br />
                      - URL: Pega la URL de arriba con tu token.<br />
                      - Cuerpo: <strong>JSON</strong> con los campos:<br />
                      &nbsp;&nbsp;• <code>amount</code> ➔ Variable <em>Importe / Cantidad</em><br />
                      &nbsp;&nbsp;• <code>merchant</code> ➔ Variable <em>Comercio</em><br />
                      &nbsp;&nbsp;• <code>cardName</code> ➔ Variable <em>Tarjeta</em>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="payload-box">
                <p className="payload-desc">
                  Puedes enviar un JSON con cualquiera de estos campos a través de la automatización:
                </p>
                <pre className="payload-code">
{`POST ${fullBase}/integrations/apple-wallet
Headers:
  Content-Type: application/json
  x-api-key: ${token}

Body:
{
  "amount": 450.00,
  "merchant": "PedidosYa / Supermercado",
  "cardName": "Apple Card / Visa",
  "date": "${new Date().toISOString()}"
}`}
                </pre>
              </div>
            )}

            {/* Test Action */}
            <div className="wallet-modal-actions">
              <button
                type="button"
                className="btn-test-transaction"
                onClick={handleTestTransaction}
                disabled={testing}
              >
                <Zap size={16} />
                <span>{testing ? 'Enviando prueba...' : 'Probar conexión ahora (Gasto de prueba)'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
