import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Building2 } from 'lucide-react';
import { getIcon } from '../utils/icons';
import './ExpenseForm.css';
import './IncomeForm.css';

export default function IncomeForm({ income, categories = [], onSubmit, onClose }) {
  const isEditing = !!income;

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    source: '',
  });

  useEffect(() => {
    if (income) {
      setFormData({
        amount: String(income.amount),
        description: income.description,
        date: new Date(income.date).toISOString().split('T')[0],
        categoryId: income.categoryId,
        source: income.source || '',
      });
    } else if (categories.length > 0 && !formData.categoryId) {
      setFormData((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [income, categories]);

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
      <div className="form-sheet income-form-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-header">
          <h2>{isEditing ? 'Editar ingreso' : 'Nuevo ingreso'}</h2>
          <button className="form-close" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Amount */}
          <div className="form-group">
            <label htmlFor="income-amount">Monto (DOP)</label>
            <div className="input-with-icon">
              <DollarSign size={18} className="input-icon" />
              <input
                id="income-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="form-input amount-input income-amount-input"
                required
                autoFocus={!isEditing}
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="income-description">Concepto</label>
            <input
              id="income-description"
              type="text"
              placeholder="Ej: Pago quincenal, Proyecto freelance..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label>Categoría de Ingreso</label>
            <div className="category-chips">
              {categories.map((cat) => {
                const IconComponent = getIcon(cat.icon);
                const isSelected = formData.categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-chip ${isSelected ? 'selected' : ''}`}
                    style={{
                      '--cat-color': cat.color,
                      borderColor: isSelected ? cat.color : undefined,
                      backgroundColor: isSelected ? `${cat.color}22` : undefined,
                    }}
                    onClick={() => handleChange('categoryId', cat.id)}
                  >
                    <IconComponent size={16} color={cat.color} />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source / Origen */}
          <div className="form-group">
            <label htmlFor="income-source">
              Origen / Empresa <span className="optional">(opcional)</span>
            </label>
            <div className="input-with-icon">
              <Building2 size={18} className="input-icon" />
              <input
                id="income-source"
                type="text"
                placeholder="Ej: Empresa X, Cliente Y, Banco..."
                value={formData.source}
                onChange={(e) => handleChange('source', e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Date */}
          <div className="form-group">
            <label htmlFor="income-date">Fecha</label>
            <div className="input-with-icon">
              <Calendar size={18} className="input-icon" />
              <input
                id="income-date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>

          {/* Submit */}
          <button type="submit" className="income-form-submit">
            {isEditing ? 'Guardar cambios' : 'Registrar ingreso'}
          </button>
        </form>
      </div>
    </div>
  );
}
