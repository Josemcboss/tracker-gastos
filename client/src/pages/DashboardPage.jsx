import { useState, useEffect, useMemo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import DonutChart from '../components/DonutChart';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import './DashboardPage.css';

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export default function DashboardPage() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const params = {};
        const now = new Date();

        if (period === 'month') {
          params.startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            .toISOString().split('T')[0];
          params.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
            .toISOString().split('T')[0];
        } else if (period === '3months') {
          params.startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
            .toISOString().split('T')[0];
          params.endDate = now.toISOString().split('T')[0];
        } else if (period === 'year') {
          params.startDate = new Date(now.getFullYear(), 0, 1)
            .toISOString().split('T')[0];
          params.endDate = now.toISOString().split('T')[0];
        }
        // 'all' ⇒ no date params

        const data = await api.getSummary(params);
        setSummary(data);
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [period]);

  const maxMonthly = useMemo(() => {
    if (!summary?.byMonth?.length) return 0;
    return Math.max(...summary.byMonth.map((m) => m.total));
  }, [summary]);

  if (loading) {
    return (
      <div className="page dashboard-page">
        <header className="page-header single">
          <h1>Resumen</h1>
        </header>
        <div className="empty-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      <header className="page-header single">
        <h1>Resumen</h1>
      </header>

      {/* Period selector */}
      <div className="period-bar">
        {[
          { value: 'month',   label: 'Este mes' },
          { value: '3months', label: '3 meses' },
          { value: 'year',    label: 'Este año' },
          { value: 'all',     label: 'Todo' },
        ].map((p) => (
          <button
            key={p.value}
            className={`period-chip ${period === p.value ? 'active' : ''}`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {/* Donut chart + legend */}
        {summary?.byCategory?.length > 0 ? (
          <section className="dashboard-section">
            <DonutChart data={summary.byCategory} total={summary.total} />

            <div className="chart-legend">
              {summary.byCategory.map((cat, i) => {
                const pct =
                  summary.total > 0
                    ? ((cat.total / summary.total) * 100).toFixed(1)
                    : 0;
                return (
                  <div key={i} className="legend-item">
                    <div
                      className="legend-dot"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="legend-name">{cat.name}</span>
                    <span className="legend-pct">{pct}%</span>
                    <span className="legend-amount">
                      {cat.total.toLocaleString('es-DO', {
                        style: 'currency',
                        currency: 'DOP',
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="empty-state small">
            <span className="empty-icon">📊</span>
            <p>No hay datos para este periodo</p>
          </div>
        )}

        {/* Monthly bar chart */}
        {summary?.byMonth?.length > 0 && (
          <section className="dashboard-section">
            <h2 className="section-title">Gasto mensual</h2>
            <div className="bar-chart">
              {summary.byMonth.map((month, i) => {
                const [, m] = month.month.split('-');
                const label = MONTH_NAMES[parseInt(m) - 1];
                const heightPct =
                  maxMonthly > 0 ? (month.total / maxMonthly) * 100 : 0;

                return (
                  <div key={i} className="bar-item">
                    <span className="bar-value">
                      {month.total >= 1000
                        ? `${(month.total / 1000).toFixed(1)}k`
                        : `$${Math.round(month.total)}`}
                    </span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                      />
                    </div>
                    <span className="bar-label">{label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Stats cards */}
        <section className="dashboard-section stats-section">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)' }}
            >
              <TrendingDown size={20} color="var(--purple-primary)" />
            </div>
            <div>
              <span className="stat-label">Total gastos</span>
              <span className="stat-value">{summary?.expenseCount || 0}</span>
            </div>
          </div>
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ backgroundColor: 'rgba(52, 211, 153, 0.15)' }}
            >
              <TrendingUp size={20} color="var(--color-success)" />
            </div>
            <div>
              <span className="stat-label">Promedio</span>
              <span className="stat-value">
                {summary?.expenseCount > 0
                  ? (summary.total / summary.expenseCount).toLocaleString(
                      'es-DO',
                      {
                        style: 'currency',
                        currency: 'DOP',
                        maximumFractionDigits: 0,
                      }
                    )
                  : '$0'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
