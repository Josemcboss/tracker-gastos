import { useState, useEffect } from 'react';
import { X, Target, Trash2, Check, AlertCircle } from 'lucide-react';
import { getIcon } from '../utils/icons';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './BudgetModal.css';

export default function BudgetModal({ isOpen, onClose, categories = [], onBudgetUpdated }) {
  const { showToast } = useToast();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadBudgets();
    if (categories.length > 0 && !selectedCatId) {
      setSelectedCatId(categories[0].id);
    }
  }, [isOpen, categories]);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const data = await api.getBudgets();
      setBudgets(data);
    } catch (err) {
      showToast(err.message || 'Error al cargar presupuestos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedCatId || !amount) return;

    setSaving(true);
    try {
      await api.saveBudget({
        categoryId: selectedCatId,
        amount: parseFloat(amount),
      });
      showToast('✅ Presupuesto guardado correctamente');
      setAmount('');
      loadBudgets();
      if (onBudgetUpdated) onBudgetUpdated();
    } catch (err) {
      showToast(err.message || 'Error al guardar presupuesto', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteBudget(id);
      showToast('Presupuesto eliminado');
      loadBudgets();
      if (onBudgetUpdated) onBudgetUpdated();
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-sheet budget-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-header">
          <div className="budget-title-wrap">
            <Target size={22} className="text-purple" />
            <h2>Presupuestos Mensuales</h2>
          </div>
          <button className="form-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <p className="budget-subtitle">
          Asigna límites mensuales por categoría para recibir alertas inteligentes y controlar tus gastos.
        </p>

        {/* Form to add/edit budget */}
        <form onSubmit={handleSave} className="budget-form">
          <div className="form-group">
            <label>Categoría</label>
            <div className="budget-cat-chips">
              {categories.map((cat) => {
                const Icon = getIcon(cat.icon);
                const isSelected = selectedCatId === cat.id;
                const hasBudget = budgets.some((b) => b.categoryId === cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`budget-cat-chip ${isSelected ? 'selected' : ''}`}
                    style={
                      isSelected
                        ? { backgroundColor: cat.color, borderColor: cat.color }
                        : {}
                    }
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      const existing = budgets.find((b) => b.categoryId === cat.id);
                      if (existing) setAmount(String(existing.amount));
                      else setAmount('');
                    }}
                  >
                    <Icon size={14} />
                    <span>{cat.name}</span>
                    {hasBudget && <span className="cat-budget-dot" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="budget-amount">Límite mensual (RD$)</label>
            <input
              id="budget-amount"
              type="number"
              step="100"
              min="1"
              placeholder="Ej: 15000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="form-input"
              required
              inputMode="numeric"
            />
          </div>

          <button type="submit" className="form-submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Fijar Presupuesto'}
          </button>
        </form>

        {/* Existing budgets list */}
        <div className="budgets-existing-section">
          <h3>Tus presupuestos activos ({budgets.length})</h3>
          {loading ? (
            <div className="budget-loading">Cargando presupuestos...</div>
          ) : budgets.length === 0 ? (
            <p className="budget-empty-msg">
              No tienes presupuestos definidos. Selecciona una categoría arriba y asígnale un límite.
            </p>
          ) : (
            <div className="budget-cards-list">
              {budgets.map((b) => {
                const Icon = getIcon(b.category?.icon);
                return (
                  <div key={b.id} className="budget-manage-card">
                    <div className="budget-manage-left">
                      <div
                        className="budget-cat-icon-badge"
                        style={{ backgroundColor: b.category?.color || '#8B5CF6' }}
                      >
                        <Icon size={16} color="#FFF" />
                      </div>
                      <div>
                        <strong>{b.category?.name}</strong>
                        <span className="budget-limit-tag">
                          Límite: RD$ {b.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-delete-budget"
                      onClick={() => handleDelete(b.id)}
                      title="Eliminar presupuesto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
