import { useState, useEffect } from 'react';
import { Target, AlertTriangle, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { getIcon } from '../utils/icons';
import api from '../services/api';
import './BudgetSection.css';

export default function BudgetSection({ onOpenManage, refreshTrigger }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBudgets();
  }, [refreshTrigger]);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const data = await api.getBudgets();
      setBudgets(data);
    } catch {
      // Quietly handle
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="dashboard-section budget-section">
        <div className="section-header-row">
          <div className="section-title-wrap">
            <Target size={18} className="text-purple" />
            <h2 className="section-title">Presupuestos Mensuales</h2>
          </div>
        </div>
        <div className="budget-loading-box">Cargando presupuestos...</div>
      </section>
    );
  }

  if (budgets.length === 0) {
    return (
      <section className="dashboard-section budget-section">
        <div className="section-header-row">
          <div className="section-title-wrap">
            <Target size={18} className="text-purple" />
            <h2 className="section-title">Presupuestos Mensuales</h2>
          </div>
        </div>
        <div className="budget-cta-card">
          <div className="budget-cta-info">
            <p className="budget-cta-title">Controla tus gastos con límites inteligentes</p>
            <p className="budget-cta-desc">
              Define cuánto quieres gastar en comida, transporte u ocio para recibir avisos antes de sobrepasarte.
            </p>
          </div>
          <button type="button" className="btn-setup-budgets" onClick={onOpenManage}>
            <span>Fijar Presupuestos</span>
            <ArrowUpRight size={16} />
          </button>
        </div>
      </section>
    );
  }

  // Calculate totals
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const overallPercentage = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  let overallColor = '#10B981'; // Green
  if (overallPercentage >= 90) overallColor = '#EF4444'; // Red
  else if (overallPercentage >= 75) overallColor = '#F59E0B'; // Yellow

  return (
    <section className="dashboard-section budget-section">
      <div className="section-header-row">
        <div className="section-title-wrap">
          <Target size={18} className="text-purple" />
          <h2 className="section-title">Presupuestos Mensuales</h2>
        </div>
        <button type="button" className="btn-manage-link" onClick={onOpenManage}>
          Ajustar límites
        </button>
      </div>

      {/* Global summary card */}
      <div className="budget-global-card">
        <div className="budget-global-header">
          <div>
            <span className="budget-global-label">Presupuesto consumido</span>
            <span className="budget-global-val">
              RD$ {totalSpent.toLocaleString('es-DO', { minimumFractionDigits: 2 })}{' '}
              <span className="budget-of-total">
                / RD$ {totalBudgeted.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </span>
          </div>
          <span className="budget-badge-status" style={{ backgroundColor: `${overallColor}22`, color: overallColor }}>
            {overallPercentage}%
          </span>
        </div>

        <div className="budget-track-global">
          <div
            className="budget-fill-global"
            style={{
              width: `${Math.min(100, overallPercentage)}%`,
              backgroundColor: overallColor,
            }}
          />
        </div>
      </div>

      {/* Category breakdown bars */}
      <div className="budget-items-grid">
        {budgets.map((b) => {
          const Icon = getIcon(b.category?.icon);

          let barColor = '#10B981'; // 🟢 Normal (< 75%)
          let statusText = 'Normal';
          let StatusIcon = CheckCircle;

          if (b.percentage >= 100) {
            barColor = '#EF4444'; // 🔴 Excedido
            statusText = 'Superado';
            StatusIcon = AlertCircle;
          } else if (b.percentage >= 90) {
            barColor = '#EF4444'; // 🔴 Límite superado (> 90%)
            statusText = 'Casi al límite';
            StatusIcon = AlertCircle;
          } else if (b.percentage >= 75) {
            barColor = '#F59E0B'; // 🟡 Precaución (75% - 90%)
            statusText = 'Precaución';
            StatusIcon = AlertTriangle;
          }

          return (
            <div key={b.id} className="budget-card-item">
              <div className="budget-item-top">
                <div className="budget-item-cat">
                  <div
                    className="budget-cat-avatar"
                    style={{ backgroundColor: b.category?.color || '#8B5CF6' }}
                  >
                    <Icon size={14} color="#FFF" />
                  </div>
                  <div>
                    <strong className="budget-item-name">{b.category?.name}</strong>
                    <span className="budget-item-sub">
                      RD$ {b.spent.toLocaleString('es-DO', { minimumFractionDigits: 0 })} de RD${' '}
                      {b.amount.toLocaleString('es-DO', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                <div className="budget-item-status-pill" style={{ color: barColor }}>
                  <StatusIcon size={12} />
                  <span>{b.percentage}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="budget-bar-track">
                <div
                  className="budget-bar-fill"
                  style={{
                    width: `${Math.min(100, b.percentage)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>

              <div className="budget-item-bottom">
                <span className="budget-remaining-text">
                  {b.percentage >= 100
                    ? `Excedido por RD$ ${(b.spent - b.amount).toLocaleString('es-DO', { minimumFractionDigits: 0 })}`
                    : `Disponible: RD$ ${b.remaining.toLocaleString('es-DO', { minimumFractionDigits: 0 })}`}
                </span>
                <span className="budget-status-label" style={{ color: barColor }}>
                  {statusText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
