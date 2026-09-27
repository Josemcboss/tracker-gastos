import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar } from 'lucide-react';
import { getIcon } from '../utils/icons';
import './ExpenseForm.css';

const PAYMENT_METHODS = [
  'Efectivo',
  'Tarjeta débito',
  'Tarjeta crédito',
  'Transferencia',
];

export default function ExpenseForm({ expense, categories, onSubmit, onClose }) {
  const isEditing = !!expense;

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    paymentMethod: '',
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        amount: String(expense.amount),
        description: expense.description,
        date: new Date(expense.date).toISOString().split('T')[0],
        categoryId: expense.categoryId,
        paymentMethod: expense.paymentMethod || '',
      });
    } else if (categories.length > 0 && !formData.categoryId) {
      setFormData((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [expense, categories]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.description || !formData.categoryId) return;
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-header">
          <h2>{isEditing ? 'Editar gasto' : 'Nuevo gasto'}</h2>
          <button className="form-close" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Amount */}
          <div className="form-group">
            <label htmlFor="expense-amount">Monto</label>
            <div className="input-with-icon">
              <DollarSign size={18} className="input-icon" />
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="form-input amount-input"
                required
                autoFocus
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="expense-desc">Descripción</label>
            <input
              id="expense-desc"
              type="text"
              placeholder="¿En qué gastaste?"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Date */}
          <div className="form-group">
            <label htmlFor="expense-date">Fecha</label>
            <div className="input-with-icon">
              <Calendar size={18} className="input-icon" />
              <input
                id="expense-date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>

          {/* Category */}
          <div className="form-group">
            <label>Categoría</label>
            <div className="category-chips">
              {categories.map((cat) => {
                const Icon = getIcon(cat.icon);
                const isSelected = formData.categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-chip ${isSelected ? 'selected' : ''}`}
                    style={
                      isSelected
                        ? { backgroundColor: cat.color, borderColor: cat.color }
                        : {}
                    }
                    onClick={() => handleChange('categoryId', cat.id)}
                  >
                    <Icon size={14} />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment method */}
          <div className="form-group">
            <label>
              Método de pago <span className="optional">(opcional)</span>
            </label>
            <div className="payment-chips">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`payment-chip ${formData.paymentMethod === method ? 'selected' : ''}`}
                  onClick={() =>
                    handleChange(
                      'paymentMethod',
                      formData.paymentMethod === method ? '' : method
                    )
                  }
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="form-submit">
            {isEditing ? 'Guardar cambios' : 'Agregar gasto'}
          </button>
        </form>
      </div>
    </div>
  );
}
