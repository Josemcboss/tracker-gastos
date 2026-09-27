import './ConfirmDialog.css';

export default function ConfirmDialog({
  title,
  message,
  confirmText = 'Eliminar',
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className={`confirm-btn ${danger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
