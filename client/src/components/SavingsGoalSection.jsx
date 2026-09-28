import { useState, useEffect } from 'react';
import { Target, PiggyBank, Plus, CheckCircle, Clock, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './SavingsGoalSection.css';

export default function SavingsGoalSection({ onOpenCreate, onOpenContribute, refreshTrigger }) {
  const { showToast } = useToast();
  const [data, setData] = useState({ goals: [], totalTarget: 0, totalSaved: 0, overallPercentage: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals();
  }, [refreshTrigger]);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await api.getGoals();
      setData(res);
    } catch {
      // Quietly handle
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteGoal(id);
      showToast('Meta eliminada');
      fetchGoals();
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error');
    }
  };

  if (loading) {
    return (
      <section className="dashboard-section goals-section">
        <div className="section-header-row">
          <div className="section-title-wrap">
            <PiggyBank size={18} className="text-purple" />
            <h2 className="section-title">Metas de Ahorro</h2>
          </div>
        </div>
        <div className="goals-loading-box">Cargando metas...</div>
      </section>
    );
  }

  const { goals, totalTarget, totalSaved, overallPercentage } = data;

  return (
    <section className="dashboard-section goals-section">
      <div className="section-header-row">
        <div className="section-title-wrap">
          <PiggyBank size={18} className="text-purple" />
          <h2 className="section-title">Metas de Ahorro</h2>
        </div>
        <button type="button" className="btn-manage-link" onClick={onOpenCreate}>
          + Nueva meta
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="goals-empty-card">
          <div className="goals-empty-text">
            <strong>Convierte tus sueños en metas alcanzables</strong>
            <p>Define un objetivo de ahorro (viaje, laptop, fondo de reserva) y acumula tus aportes paso a paso.</p>
          </div>
          <button type="button" className="btn-setup-budgets" onClick={onOpenCreate}>
            <Plus size={15} />
            <span>Crear Primera Meta</span>
          </button>
        </div>
      ) : (
        <>
          {/* Global summary card */}
          <div className="goals-global-card">
            <div className="goals-global-left">
              <span className="goals-global-label">Total Ahorrado Acumulado</span>
              <strong className="goals-global-amount">
                RD$ {totalSaved.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </strong>
              <span className="goals-global-target">
                de RD$ {totalTarget.toLocaleString('es-DO', { minimumFractionDigits: 2 })} meta global
              </span>
            </div>
            <div className="goals-global-badge">
              <span>{overallPercentage}%</span>
            </div>
          </div>

          {/* Goals Cards Grid */}
          <div className="goals-grid">
            {goals.map((g) => {
              const isDone = g.isCompleted;
              return (
                <div key={g.id} className="goal-card-item">
                  <div className="goal-card-top">
                    <div className="goal-title-wrap">
                      <div className="goal-icon-badge" style={{ backgroundColor: isDone ? '#10B981' : g.color }}>
                        {isDone ? <CheckCircle size={15} color="#FFF" /> : <Target size={15} color="#FFF" />}
                      </div>
                      <div>
                        <strong className="goal-name">{g.title}</strong>
                        {g.daysRemaining !== null && (
                          <span className="goal-deadline">
                            <Clock size={11} />
                            <span>{g.daysRemaining === 0 ? '¡Hoy vence!' : `${g.daysRemaining} días restantes`}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-delete-goal"
                      onClick={() => handleDelete(g.id)}
                      title="Eliminar meta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Amounts */}
                  <div className="goal-amounts-row">
                    <span className="goal-current-val">
                      RD$ {g.currentAmount.toLocaleString('es-DO', { minimumFractionDigits: 0 })}
                    </span>
                    <span className="goal-target-val">
                      de RD$ {g.targetAmount.toLocaleString('es-DO', { minimumFractionDigits: 0 })} ({g.percentage}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="goal-track">
                    <div
                      className="goal-fill"
                      style={{
                        width: `${Math.min(100, g.percentage)}%`,
                        backgroundColor: isDone ? '#10B981' : g.color,
                      }}
                    />
                  </div>

                  {/* Footer & Actions */}
                  <div className="goal-card-footer">
                    <span className="goal-remaining-label">
                      {isDone
                        ? '🎉 ¡Meta cumplida con éxito!'
                        : `Faltan: RD$ ${g.remaining.toLocaleString('es-DO', { minimumFractionDigits: 0 })}`}
                    </span>

                    {!isDone && (
                      <button
                        type="button"
                        className="btn-contribute-action"
                        onClick={() => onOpenContribute(g)}
                      >
                        <Plus size={13} />
                        <span>Aportar</span>
                      </button>
                    )}
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
