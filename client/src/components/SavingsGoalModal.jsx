import { useState } from 'react';
import { X, Target, DollarSign, Calendar, PiggyBank } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './SavingsGoalModal.css';

export default function SavingsGoalModal({
  isOpen,
  onClose,
  contributeGoal = null, // If set, modal is in "Aportar" mode
  onGoalSaved,
}) {
  const { showToast } = useToast();
  const isContribute = !!contributeGoal;

  const [formData, setFormData] = useState({
    title: '',
    targetAmount: '',
    currentAmount: '',
    targetDate: '',
    color: '#8B5CF6',
  });
  const [contributionAmount, setContributionAmount] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmitCreate = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.targetAmount) return;

    setSaving(true);
    try {
      await api.createGoal({
        title: formData.title,
        targetAmount: parseFloat(formData.targetAmount),
        currentAmount: parseFloat(formData.currentAmount) || 0,
        targetDate: formData.targetDate || null,
        color: formData.color,
      });

      showToast(`🎯 Meta "${formData.title}" creada`);
      setFormData({
        title: '',
        targetAmount: '',
        currentAmount: '',
        targetDate: '',
        color: '#8B5CF6',
      });
      if (onGoalSaved) onGoalSaved();
      onClose();
    } catch (err) {
      showToast(err.message || 'Error al crear meta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleContribute = async (e) => {
    e.preventDefault();
    if (!contributionAmount) return;

    setSaving(true);
    try {
      const res = await api.contributeToGoal(contributeGoal.id, parseFloat(contributionAmount));
      showToast(res.message || '¡Aporte realizado con éxito!');
      setContributionAmount('');
      if (onGoalSaved) onGoalSaved();
      onClose();
    } catch (err) {
      showToast(err.message || 'Error al aportar a la meta', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-sheet goal-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="form-header">
          <div className="goal-modal-title">
            {isContribute ? (
              <>
                <PiggyBank size={22} className="text-purple" />
                <h2>Aportar a Meta</h2>
              </>
            ) : (
              <>
                <Target size={22} className="text-purple" />
                <h2>Nueva Meta de Ahorro</h2>
              </>
            )}
          </div>
          <button className="form-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {isContribute ? (
          /* Contribution Form */
          <form onSubmit={handleContribute}>
            <div className="goal-contribute-card">
              <span className="goal-contribute-name">{contributeGoal.title}</span>
              <span className="goal-contribute-status">
                Progreso actual: RD$ {contributeGoal.currentAmount.toLocaleString('es-DO')} de RD${' '}
                {contributeGoal.targetAmount.toLocaleString('es-DO')} ({contributeGoal.percentage}%)
              </span>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label htmlFor="contrib-amount">Monto a abonar (RD$)</label>
              <div className="input-with-icon">
                <DollarSign size={18} className="input-icon" />
                <input
                  id="contrib-amount"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  className="form-input"
                  required
                  autoFocus
                  inputMode="decimal"
                />
              </div>
              <div className="quick-amount-presets">
                {[500, 1000, 2000, 5000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="quick-preset-btn"
                    onClick={() => {
                      const curr = parseFloat(contributionAmount) || 0;
                      setContributionAmount(String(curr + val));
                    }}
                  >
                    +{val.toLocaleString('es-DO')}
                  </button>
                ))}
                {contributionAmount && (
                  <button
                    type="button"
                    className="quick-preset-btn reset"
                    onClick={() => setContributionAmount('')}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <button type="submit" className="form-submit" disabled={saving}>
              {saving ? 'Guardando aporte...' : 'Confirmar Aporte'}
            </button>
          </form>
        ) : (
          /* Create Goal Form */
          <form onSubmit={handleSubmitCreate}>
            <p className="goal-modal-desc">
              Define tu objetivo (viajes, fondo de emergencia, compras) y hazle seguimiento al progreso.
            </p>

            <div className="form-group">
              <label htmlFor="goal-title">Nombre de la meta</label>
              <input
                id="goal-title"
                type="text"
                placeholder="Ej: Fondo de Emergencia, Vacaciones, Laptop..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="form-input"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="goal-target">Monto meta a alcanzar (RD$)</label>
              <div className="input-with-icon">
                <DollarSign size={18} className="input-icon" />
                <input
                  id="goal-target"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Ej: 50000"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                  className="form-input"
                  required
                  inputMode="decimal"
                />
              </div>
              <div className="quick-amount-presets">
                {[5000, 10000, 25000, 50000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="quick-preset-btn"
                    onClick={() => {
                      const curr = parseFloat(formData.targetAmount) || 0;
                      setFormData({ ...formData, targetAmount: String(curr + val) });
                    }}
                  >
                    +{val.toLocaleString('es-DO')}
                  </button>
                ))}
                {formData.targetAmount && (
                  <button
                    type="button"
                    className="quick-preset-btn reset"
                    onClick={() => setFormData({ ...formData, targetAmount: '' })}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="goal-initial">Ahorro inicial ya disponible (opcional)</label>
              <input
                id="goal-initial"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={formData.currentAmount}
                onChange={(e) => setFormData({ ...formData, currentAmount: e.target.value })}
                className="form-input"
                inputMode="decimal"
              />
            </div>

            <div className="form-group">
              <label htmlFor="goal-date">Fecha objetivo (opcional)</label>
              <input
                id="goal-date"
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="form-input"
              />
            </div>

            <button type="submit" className="form-submit" disabled={saving}>
              {saving ? 'Creando meta...' : 'Crear Meta de Ahorro'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
