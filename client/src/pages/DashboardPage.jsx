import { useState, useEffect, useMemo } from 'react';
import { TrendingDown, TrendingUp, Wallet, Receipt, ArrowUpRight, ArrowDownRight, Scale, Download } from 'lucide-react';
import DonutChart from '../components/DonutChart';
import AdBanner from '../components/AdBanner';
import BudgetSection from '../components/BudgetSection';
import BudgetModal from '../components/BudgetModal';
import SubscriptionSection from '../components/SubscriptionSection';
import SubscriptionModal from '../components/SubscriptionModal';
import SavingsGoalSection from '../components/SavingsGoalSection';
import SavingsGoalModal from '../components/SavingsGoalModal';
import ExportModal from '../components/ExportModal';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import './DashboardPage.css';

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export default function DashboardPage() {
  const { showToast } = useToast();
  const [expensesSummary, setExpensesSummary] = useState(null);
  const [incomesSummary, setIncomesSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [chartView, setChartView] = useState('expenses'); // 'expenses' | 'incomes'
  const [activeCatIndex, setActiveCatIndex] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);

  const [showSubModal, setShowSubModal] = useState(false);
  const [subRefreshKey, setSubRefreshKey] = useState(0);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [contributeGoal, setContributeGoal] = useState(null);
  const [goalRefreshKey, setGoalRefreshKey] = useState(0);

  useEffect(() => {
    const fetchSummaries = async () => {
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
        // 'all' => no date params

        const [expData, incData, catData] = await Promise.all([
          api.getSummary(params),
          api.getIncomeSummary(params),
          api.getCategories(),
        ]);
        setExpensesSummary(expData);
        setIncomesSummary(incData);
        setCategories(catData || []);
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchSummaries();
  }, [period]);

  const activeSummary = chartView === 'expenses' ? expensesSummary : incomesSummary;

  const totalExpenses = expensesSummary?.total || 0;
  const totalIncomes = incomesSummary?.total || 0;
  const netBalance = totalIncomes - totalExpenses;

  const maxMonthly = useMemo(() => {
    if (!activeSummary?.byMonth?.length) return 0;
    return Math.max(...activeSummary.byMonth.map((m) => m.total));
  }, [activeSummary]);

  if (loading) {
    return (
      <div className="page dashboard-page">
        <header className="page-header single">
          <h1>Resumen Financiero</h1>
        </header>
        <div className="empty-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Resumen Financiero</h1>
        <button
          type="button"
          className="btn-header-action"
          onClick={() => setShowExportModal(true)}
          title="Descargar reporte en Excel o PDF"
        >
          <Download size={13} />
          <span>Exportar</span>
        </button>
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
            onClick={() => {
              setPeriod(p.value);
              setActiveCatIndex(null);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {/* KPI Financial Overview Cards */}
        <div className="kpi-grid">
          <div className="kpi-card income-kpi">
            <div className="kpi-header">
              <span className="kpi-label">Ingresos</span>
              <ArrowUpRight size={18} className="kpi-icon-inc" />
            </div>
            <span className="kpi-value inc-color">
              +{totalIncomes.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}
            </span>
          </div>

          <div className="kpi-card expense-kpi">
            <div className="kpi-header">
              <span className="kpi-label">Gastos</span>
              <ArrowDownRight size={18} className="kpi-icon-exp" />
            </div>
            <span className="kpi-value exp-color">
              -{totalExpenses.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}
            </span>
          </div>

          <div className={`kpi-card balance-kpi ${netBalance >= 0 ? 'pos' : 'neg'}`}>
            <div className="kpi-header">
              <span className="kpi-label">Balance Neto</span>
              <Scale size={18} className="kpi-icon-bal" />
            </div>
            <span className="kpi-value bal-color">
              {netBalance >= 0 ? '+' : ''}
              {netBalance.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}
            </span>
          </div>
        </div>

        {/* Chart View Switcher: Gastos vs Ingresos */}
        <div className="category-type-tabs" style={{ margin: '18px 0 14px' }}>
          <button
            className={`cat-type-tab ${chartView === 'expenses' ? 'active' : ''}`}
            onClick={() => {
              setChartView('expenses');
              setActiveCatIndex(null);
            }}
          >
            <Receipt size={16} />
            <span>Gastos por Categoría</span>
          </button>
          <button
            className={`cat-type-tab ${chartView === 'incomes' ? 'active' : ''}`}
            onClick={() => {
              setChartView('incomes');
              setActiveCatIndex(null);
            }}
            style={chartView === 'incomes' ? { borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.18)' } : undefined}
          >
            <Wallet size={16} />
            <span>Ingresos por Categoría</span>
          </button>
        </div>

        {/* Donut chart + legend */}
        {activeSummary?.byCategory?.length > 0 ? (
          <section className="dashboard-section">
            <DonutChart
              data={activeSummary.byCategory}
              total={activeSummary.total}
              activeIndex={activeCatIndex}
              onActiveChange={setActiveCatIndex}
            />

            <div className="chart-legend">
              {activeSummary.byCategory.map((cat, i) => {
                const pct =
                  activeSummary.total > 0
                    ? ((cat.total / activeSummary.total) * 100).toFixed(1)
                    : 0;
                const isSelected = activeCatIndex === i;
                const isAnySelected = activeCatIndex !== null;
                return (
                  <div
                    key={i}
                    className={`legend-item ${isSelected ? 'highlighted' : (isAnySelected ? 'dimmed' : '')}`}
                    onMouseEnter={() => setActiveCatIndex(i)}
                    onMouseLeave={() => setActiveCatIndex(null)}
                    onClick={() => setActiveCatIndex(activeCatIndex === i ? null : i)}
                  >
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
            <p>
              {chartView === 'expenses'
                ? 'No hay gastos registrados en este periodo'
                : 'No hay ingresos registrados en este periodo'}
            </p>
          </div>
        )}

        {/* Smart Category Budgets */}
        <BudgetSection
          onOpenManage={() => setShowBudgetModal(true)}
          refreshTrigger={budgetRefreshKey}
        />

        {/* Subscriptions & Recurring Expenses */}
        <SubscriptionSection
          onOpenAdd={() => setShowSubModal(true)}
          refreshTrigger={subRefreshKey}
        />

        {/* Savings Goals */}
        <SavingsGoalSection
          onOpenCreate={() => {
            setContributeGoal(null);
            setShowGoalModal(true);
          }}
          onOpenContribute={(goal) => {
            setContributeGoal(goal);
            setShowGoalModal(true);
          }}
          refreshTrigger={goalRefreshKey}
        />

        {/* Monthly bar chart */}
        {activeSummary?.byMonth?.length > 0 && (
          <section className="dashboard-section">
            <h2 className="section-title">
              {chartView === 'expenses' ? 'Evolución mensual de gastos' : 'Evolución mensual de ingresos'}
            </h2>
            <div className="bar-chart">
              {activeSummary.byMonth.map((month, i) => {
                const [, m] = month.month.split('-');
                const label = MONTH_NAMES[parseInt(m) - 1];
                const heightPct =
                  maxMonthly > 0
                    ? Math.round((month.total / maxMonthly) * 100)
                    : 0;
                return (
                  <div key={i} className="bar-col">
                    <span className="bar-val">
                      {month.total >= 1000
                        ? `${(month.total / 1000).toFixed(1)}k`
                        : month.total.toFixed(0)}
                    </span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          height: `${heightPct}%`,
                          animationDelay: `${i * 60}ms`,
                          backgroundColor: chartView === 'incomes' ? '#10B981' : undefined,
                        }}
                      />
                    </div>
                    <span className="bar-label">{label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Google AdSense Banner */}
        <AdBanner className="dashboard-ad-banner" />
      </div>

      {/* Budget Management Sheet */}
      <BudgetModal
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        categories={categories}
        onBudgetUpdated={() => setBudgetRefreshKey((k) => k + 1)}
      />

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
        categories={categories}
        onSubscriptionSaved={() => setSubRefreshKey((k) => k + 1)}
      />

      {/* Savings Goal Modal */}
      <SavingsGoalModal
        isOpen={showGoalModal}
        onClose={() => {
          setShowGoalModal(false);
          setContributeGoal(null);
        }}
        contributeGoal={contributeGoal}
        onGoalSaved={() => setGoalRefreshKey((k) => k + 1)}
      />

      {/* Export Report Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}
