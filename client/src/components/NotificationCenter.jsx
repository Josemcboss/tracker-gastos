import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Calendar, Check, ExternalLink, X, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import './NotificationCenter.css';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_alerts') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    checkAlerts();
  }, []);

  const checkAlerts = async () => {
    setLoading(true);
    try {
      const [budgets, subscriptions, dashboardData] = await Promise.all([
        api.getBudgets().catch(() => []),
        api.getSubscriptions().catch(() => []),
        api.getDashboard().catch(() => null),
      ]);

      const newAlerts = [];
      const now = new Date();
      const currentDay = now.getDate();

      // 1. Budget Alerts
      if (budgets.length > 0 && dashboardData?.byCategory) {
        for (const b of budgets) {
          const catStat = dashboardData.byCategory.find((c) => c.id === b.categoryId);
          const spent = catStat ? catStat.total : 0;
          const ratio = spent / (b.amount || 1);
          const percent = Math.round(ratio * 100);

          if (percent >= 85) {
            newAlerts.push({
              id: `budget_${b.id}_${now.getMonth()}`,
              type: percent >= 100 ? 'danger' : 'warning',
              icon: AlertTriangle,
              title: percent >= 100 ? '🚨 Límite de Presupuesto Excedido' : '⚠️ Presupuesto al Límite',
              message: `Has consumido el ${percent}% (RD$ ${spent.toLocaleString('es-DO')}) de tu presupuesto en ${b.category?.name || 'la categoría'}.`,
              time: 'Alerta mensual',
            });
          }
        }
      }

      // 2. Subscription Alerts (due in <= 2 days)
      if (subscriptions.length > 0) {
        for (const sub of subscriptions) {
          if (!sub.active) continue;

          let diff = sub.billingDay - currentDay;
          if (diff < 0) {
            // Check next month wrap-around
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            diff = (daysInMonth - currentDay) + sub.billingDay;
          }

          if (diff >= 0 && diff <= 2) {
            const timeText = diff === 0 ? '¡Se cobra hoy!' : diff === 1 ? 'Se cobra mañana' : 'Se cobra en 2 días';
            newAlerts.push({
              id: `sub_${sub.id}_${now.getMonth()}_${sub.billingDay}`,
              type: 'info',
              icon: Calendar,
              title: `📅 Cobro Próximo: ${sub.name}`,
              message: `${timeText}. Monto estimado: RD$ ${sub.amount.toLocaleString('es-DO')}.`,
              time: timeText,
            });
          }
        }
      }

      setAlerts(newAlerts);

      // Trigger Web Push Notification if permission granted and alerts found
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        newAlerts.length > 0
      ) {
        const lastNotified = sessionStorage.getItem('last_web_notification');
        if (!lastNotified) {
          const first = newAlerts[0];
          new Notification(first.title, {
            body: first.message,
            icon: '/icon-192.png',
          });
          sessionStorage.setItem('last_web_notification', String(Date.now()));
        }
      }
    } catch (err) {
      console.error('Failed to check alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones de escritorio.');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted' && alerts.length > 0) {
        new Notification('🔔 Notificaciones Activadas', {
          body: 'Recibirás avisos de cobro de suscripciones y alertas de presupuestos.',
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));
  const unreadCount = activeAlerts.length;

  const dismissAlert = (id) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    localStorage.setItem('dismissed_alerts', JSON.stringify(updated));
  };

  const dismissAll = () => {
    const updated = alerts.map((a) => a.id);
    setDismissedIds(updated);
    localStorage.setItem('dismissed_alerts', JSON.stringify(updated));
  };

  return (
    <div className="notif-center-wrapper">
      <button
        type="button"
        className="btn-notif-bell"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificaciones"
        title="Centro de Alertas Preventivas"
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <>
          <div className="notif-backdrop" onClick={() => setIsOpen(false)} />
          <div className="notif-dropdown">
            <div className="notif-header">
              <div className="notif-title-row">
                <Bell size={16} className="text-purple" />
                <strong>Alertas Preventivas</strong>
                {unreadCount > 0 && <span className="notif-tag">{unreadCount} nuevas</span>}
              </div>
              <button className="notif-close-btn" onClick={() => setIsOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Permission Banner if not enabled */}
            {permission !== 'granted' && (
              <div className="notif-permission-banner">
                <div>
                  <p>¿Activar notificaciones en el navegador?</p>
                  <span>Recibe alertas cuando una suscripción esté por vencer.</span>
                </div>
                <button type="button" className="btn-enable-push" onClick={requestNotificationPermission}>
                  Activar
                </button>
              </div>
            )}

            <div className="notif-list">
              {loading ? (
                <div className="notif-empty">Verificando estado de tus finanzas...</div>
              ) : activeAlerts.length === 0 ? (
                <div className="notif-empty">
                  <Check size={28} color="#34D399" />
                  <p>¡Todo en orden!</p>
                  <span>Tus presupuestos están saludables y no tienes cobros inmediatos.</span>
                </div>
              ) : (
                activeAlerts.map((alert) => {
                  const Icon = alert.icon;
                  return (
                    <div key={alert.id} className={`notif-item ${alert.type}`}>
                      <div className="notif-item-icon">
                        <Icon size={16} />
                      </div>
                      <div className="notif-item-content">
                        <h4>{alert.title}</h4>
                        <p>{alert.message}</p>
                        <span className="notif-time">{alert.time}</span>
                      </div>
                      <button
                        type="button"
                        className="notif-item-dismiss"
                        onClick={() => dismissAlert(alert.id)}
                        title="Marcar como leída"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {activeAlerts.length > 0 && (
              <div className="notif-footer">
                <button type="button" className="btn-notif-clear-all" onClick={dismissAll}>
                  Marcar todas como leídas
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
