import { useState } from 'react';
import { X, Calendar, DollarSign, Repeat, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './SubscriptionModal.css';

export default function SubscriptionModal({ isOpen, onClose, categories = [], onSubscriptionSaved }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    billingDay: '1',
    billingCycle: 'monthly',
    categoryId: '',
    paymentMethod: 'Tarjeta crédito',
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.amount || !formData.billingDay) return;

    setSaving(true);
    try {
      await api.createSubscription({
        name: formData.name,
        amount: parseFloat(formData.amount),
        billingDay: parseInt(formData.billingDay, 10),
        billingCycle: formData.billingCycle,
        categoryId: formData.categoryId || null,
        paymentMethod: formData.paymentMethod || null,
      });

      showToast(`✅ Suscripción "${formData.name}" agregada`);
      setFormData({
        name: '',
        amount: '',
        billingDay: '1',
        billingCycle: 'monthly',
        categoryId: '',
        paymentMethod: 'Tarjeta crédito',
      });
      if (onSubscriptionSaved) onSubscriptionSaved();
      onClose();
    } catch (err) {
      showToast(err.message || 'Error al guardar suscripción', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-sheet sub-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="form-header">
          <div className="sub-modal-title">
            <Repeat size={22} className="text-purple" />
            <h2>Nueva Suscripción / Pago Fijo</h2>
          </div>
          <button className="form-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <p className="sub-modal-desc">
          Registra tus gastos recurrentes (Netflix, gimnasio, alquiler, internet) para saber cuándo te cobrarán y tener bajo control tus costos fijos.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="sub-name">Servicio o Concepto</label>
            <input
              id="sub-name"
              type="text"
              placeholder="Ej: Netflix, Alquiler, Gimnasio, Internet..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="sub-amount">Monto a pagar (RD$)</label>
            <div className="input-with-icon">
              <DollarSign size={18} className="input-icon" />
              <input
                id="sub-amount"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="form-input"
                required
                inputMode="decimal"
              />
            </div>
            <div className="quick-amount-presets">
              {[500, 1000, 2000, 3000].map((val) => (
                <button
                  key={val}
                  type="button"
                  className="quick-preset-btn"
                  onClick={() => {
                    const curr = parseFloat(formData.amount) || 0;
                    setFormData({ ...formData, amount: String(curr + val) });
                  }}
                >
                  +{val.toLocaleString('es-DO')}
                </button>
              ))}
              {formData.amount && (
                <button
                  type="button"
                  className="quick-preset-btn reset"
                  onClick={() => setFormData({ ...formData, amount: '' })}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="sub-day">Día de cobro del mes (1 - 31)</label>
            <input
              id="sub-day"
              type="number"
              min="1"
              max="31"
              placeholder="Ej: 15"
              value={formData.billingDay}
              onChange={(e) => setFormData({ ...formData, billingDay: e.target.value })}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="sub-category">Categoría (opcional)</label>
            <select
              id="sub-category"
              className="form-input"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            >
              <option value="">Sin categoría específica</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="form-submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar Suscripción'}
          </button>
        </form>
      </div>
    </div>
  );
}
