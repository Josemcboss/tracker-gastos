import { Trash2, Pencil } from 'lucide-react';
import { getIcon } from '../utils/icons';
import './ExpenseCard.css';

export default function IncomeCard({ income, onEdit, onDelete }) {
  const { amount, description, date, category, source } = income;
  const IconComponent = getIcon(category?.icon || 'wallet');

  const formattedDate = new Date(date).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
  });

  const formattedAmount = parseFloat(amount).toLocaleString('es-DO', {
    style: 'currency',
    currency: 'DOP',
  });

  return (
    <div className="expense-card income-card-variant">
      <div className="expense-card-left">
        <div
          className="expense-icon"
          style={{ backgroundColor: `${category?.color || '#10B981'}20` }}
        >
          <IconComponent
            size={20}
            color={category?.color || '#10B981'}
            strokeWidth={1.8}
          />
        </div>
        <div className="expense-info">
          <span className="expense-description">{description}</span>
          <span className="expense-meta">
            {formattedDate} · {category?.name || 'Ingreso'}
            {source ? ` · ${source}` : ''}
          </span>
        </div>
      </div>
      <div className="expense-card-right">
        <span className="expense-amount" style={{ color: '#10B981' }}>
          +{formattedAmount}
        </span>
        <div className="expense-actions">
          <button
            className="action-btn"
            onClick={() => onEdit(income)}
            aria-label="Editar ingreso"
          >
            <Pencil size={15} />
          </button>
          <button
            className="action-btn delete"
            onClick={() => onDelete(income)}
            aria-label="Eliminar ingreso"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
