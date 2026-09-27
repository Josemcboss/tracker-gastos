import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import ExpenseCard from '../components/ExpenseCard';
import ExpenseForm from '../components/ExpenseForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './ExpensesPage.css';

export default function ExpensesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filterCategory) params.categoryId = filterCategory;

      const [expData, catData] = await Promise.all([
        api.getExpenses(params),
        api.getCategories(),
      ]);
      setExpenses(expData.expenses);
      setCategories(catData);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (formData) => {
    try {
      if (editingExpense) {
        await api.updateExpense(editingExpense.id, formData);
        showToast('Gasto actualizado ✓');
      } else {
        await api.createExpense(formData);
        showToast('Gasto agregado ✓');
      }
      setShowForm(false);
      setEditingExpense(null);
      fetchData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      await api.deleteExpense(deletingExpense.id);
      showToast('Gasto eliminado');
      setDeletingExpense(null);
      fetchData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const openNew = () => {
    setEditingExpense(null);
    setShowForm(true);
  };

  // Group expenses by date
  const groupedExpenses = expenses.reduce((groups, expense) => {
    const dateKey = new Date(expense.date).toLocaleDateString('es-DO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(expense);
    return groups;
  }, {});

  const periodTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="page expenses-page">
      {/* Header */}
      <header className="page-header">
        <div
          className="user-greeting-wrapper"
          onClick={() => navigate('/profile')}
          title="Ver mi perfil"
        >
          <div className="header-avatar-mini">
            {user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <span className="greeting">Hola, {user?.name?.split(' ')[0]} 👋</span>
            <h1>Tus gastos</h1>
          </div>
        </div>
        <div className="month-total">
          <span className="month-total-label">Total</span>
          <span className="month-total-amount">
            {periodTotal.toLocaleString('es-DO', {
              style: 'currency',
              currency: 'DOP',
            })}
          </span>
        </div>
      </header>

      {/* Category filter bar */}
      <div className="filter-bar">
        <button
          className={`filter-chip ${filterCategory === '' ? 'active' : ''}`}
          onClick={() => setFilterCategory('')}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`filter-chip ${filterCategory === cat.id ? 'active' : ''}`}
            style={
              filterCategory === cat.id
                ? { backgroundColor: cat.color, borderColor: cat.color }
                : {}
            }
            onClick={() =>
              setFilterCategory(filterCategory === cat.id ? '' : cat.id)
            }
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Expense list */}
      <div className="expense-list">
        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📝</span>
            <p>No hay gastos aún</p>
            <p className="empty-sub">
              Toca el botón + para agregar tu primer gasto
            </p>
          </div>
        ) : (
          Object.entries(groupedExpenses).map(([date, items]) => (
            <div key={date} className="expense-group">
              <h3 className="group-date">{date}</h3>
              <div className="group-items">
                {items.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    onEdit={handleEdit}
                    onDelete={setDeletingExpense}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating action button */}
      <button className="fab" onClick={openNew} aria-label="Agregar gasto" id="add-expense-btn">
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* Expense form modal */}
      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          categories={categories}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingExpense(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deletingExpense && (
        <ConfirmDialog
          title="Eliminar gasto"
          message={`¿Estás seguro de que quieres eliminar "${deletingExpense.description}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingExpense(null)}
        />
      )}
    </div>
  );
}
