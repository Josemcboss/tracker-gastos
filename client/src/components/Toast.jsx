import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import './Toast.css';

export default function Toast() {
  const { toast, hideToast } = useToast();

  if (!toast) return null;

  const Icon = toast.type === 'success' ? CheckCircle : AlertCircle;
  const iconColor =
    toast.type === 'success' ? 'var(--color-success)' : 'var(--color-error)';

  return (
    <div className={`toast toast-${toast.type}`} key={toast.id}>
      <Icon size={20} color={iconColor} />
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={hideToast} aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
}
