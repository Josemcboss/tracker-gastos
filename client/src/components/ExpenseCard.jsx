import { Trash2, Pencil } from 'lucide-react';
import { getIcon } from '../utils/icons';
import './ExpenseCard.css';

export default function ExpenseCard({ expense, onEdit, onDelete }) {
  const { amount, description, date, category, paymentMethod } = expense;
  const IconComponent = getIcon(category?.icon);

  const formattedDate = new Date(date).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
  });

  const formattedAmount = parseFloat(amount).toLocaleString('es-DO', {
    style: 'currency',
    currency: 'DOP',
  });

  return (
    <div className="expense-card">
      <div className="expense-card-left">
        <div
          className="expense-icon"
          style={{ backgroundColor: `${category?.color || '#52525B'}1A` }}
        >
          <IconComponent
            size={20}
            color={category?.color || '#52525B'}
            strokeWidth={1.8}
          />
        </div>
        <div className="expense-info">
          <span className="expense-description">{description}</span>
          <span className="expense-meta">
            {formattedDate} · {category?.name || 'Sin categoría'}
            {paymentMethod ? ` · ${paymentMethod}` : ''}
          </span>
        </div>
      </div>
      <div className="expense-card-right">
        <span className="expense-amount">{formattedAmount}</span>
        <div className="expense-actions">
          <button
            className="action-btn"
            onClick={() => onEdit(expense)}
            aria-label="Editar gasto"
          >
            <Pencil size={15} />
          </button>
          <button
            className="action-btn delete"
            onClick={() => onDelete(expense)}
            aria-label="Eliminar gasto"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
