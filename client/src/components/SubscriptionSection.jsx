import { useState, useEffect } from 'react';
import { Repeat, Clock, Plus, Trash2, Calendar } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './SubscriptionSection.css';

export default function SubscriptionSection({ onOpenAdd, refreshTrigger }) {
  const { showToast } = useToast();
  const [data, setData] = useState({ subscriptions: [], monthlyTotal: 0, activeCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, [refreshTrigger]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await api.getSubscriptions();
      setData(res);
    } catch {
      // Quietly handle
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteSubscription(id);
      showToast('Suscripción eliminada');
      fetchSubscriptions();
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error');
    }
  };

  if (loading) {
    return (
      <section className="dashboard-section sub-section">
        <div className="section-header-row">
          <div className="section-title-wrap">
            <Repeat size={18} className="text-purple" />
            <h2 className="section-title">Suscripciones y Gastos Fijos</h2>
          </div>
        </div>
        <div className="sub-loading-box">Cargando pagos recurrentes...</div>
      </section>
    );
  }

  const { subscriptions, monthlyTotal, activeCount } = data;

  return (
    <section className="dashboard-section sub-section">
      <div className="section-header-row">
        <div className="section-title-wrap">
          <Repeat size={18} className="text-purple" />
          <h2 className="section-title">Suscripciones y Gastos Fijos</h2>
        </div>
        <button type="button" className="btn-manage-link" onClick={onOpenAdd}>
          + Nueva
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="sub-empty-card">
          <div className="sub-empty-text">
            <strong>Nunca olvides la fecha de un pago</strong>
            <p>Registra Netflix, Spotify, membresías o tu alquiler para ver la cuenta regresiva antes del cobro.</p>
          </div>
          <button type="button" className="btn-setup-budgets" onClick={onOpenAdd}>
            <Plus size={15} />
            <span>Agregar Suscripción</span>
          </button>
        </div>
      ) : (
        <>
          {/* Summary KPI Card */}
          <div className="sub-summary-card">
            <div>
              <span className="sub-summary-label">Compromiso Fijo Mensual</span>
              <strong className="sub-summary-amount">
                RD$ {monthlyTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <span className="sub-count-badge">
              {activeCount} {activeCount === 1 ? 'servicio' : 'servicios'}
            </span>
          </div>

          {/* Cards List */}
          <div className="sub-items-list">
            {subscriptions.map((sub) => {
              const isDueSoon = sub.daysUntilDue <= 3;
              return (
                <div key={sub.id} className="sub-card-item">
                  <div className="sub-card-left">
                    <div className="sub-icon-avatar">
                      <Repeat size={15} />
                    </div>
                    <div>
                      <strong className="sub-item-name">{sub.name}</strong>
                      <span className="sub-item-date">
                        <Calendar size={11} />
                        <span>Día {sub.billingDay} de cada mes</span>
                      </span>
                    </div>
                  </div>

                  <div className="sub-card-right">
                    <strong className="sub-item-price">
                      RD$ {sub.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </strong>
                    <div className="sub-card-actions">
                      <span className={`sub-due-pill ${isDueSoon ? 'due-soon' : ''}`}>
                        <Clock size={11} />
                        <span>
                          {sub.daysUntilDue === 0
                            ? '¡Cobro hoy!'
                            : sub.daysUntilDue === 1
                            ? 'Mañana'
                            : `En ${sub.daysUntilDue} días`}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn-delete-sub"
                        onClick={() => handleDelete(sub.id)}
                        title="Eliminar suscripción"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
