import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Receipt, Wallet, Download } from 'lucide-react';
import ExpenseCard from '../components/ExpenseCard';
import ExpenseForm from '../components/ExpenseForm';
import IncomeCard from '../components/IncomeCard';
import IncomeForm from '../components/IncomeForm';
import ConfirmDialog from '../components/ConfirmDialog';
import ImportModal from '../components/ImportModal';
import ExportModal from '../components/ExportModal';
import AdBanner from '../components/AdBanner';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './ExpensesPage.css';

export default function ExpensesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [mainTab, setMainTab] = useState('expenses'); // 'expenses' | 'incomes'
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterCategory) params.categoryId = filterCategory;

      if (mainTab === 'expenses') {
        const [expData, catData] = await Promise.all([
          api.getExpenses(params),
          api.getCategories(),
        ]);
        setItems(expData.expenses || []);
        setCategories(catData || []);
      } else {
        const [incData, catData] = await Promise.all([
          api.getIncomes(params),
          api.getIncomeCategories(),
        ]);
        setItems(incData.incomes || []);
        setCategories(catData || []);
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [mainTab, filterCategory]);

  useEffect(() => {
    setFilterCategory('');
  }, [mainTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (formData) => {
    try {
      if (mainTab === 'expenses') {
        if (editingItem) {
          await api.updateExpense(editingItem.id, formData);
          showToast('Gasto actualizado ✓');
        } else {
          await api.createExpense(formData);
          showToast('Gasto agregado ✓');
        }
      } else {
        if (editingItem) {
          await api.updateIncome(editingItem.id, formData);
          showToast('Ingreso actualizado ✓');
        } else {
          await api.createIncome(formData);
          showToast('Ingreso registrado ✓');
        }
      }
      setShowForm(false);
      setEditingItem(null);
      fetchData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      if (mainTab === 'expenses') {
        await api.deleteExpense(deletingItem.id);
        showToast('Gasto eliminado');
      } else {
        await api.deleteIncome(deletingItem.id);
        showToast('Ingreso eliminado');
      }
      setDeletingItem(null);
      fetchData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const openNew = () => {
    setEditingItem(null);
    setShowForm(true);
  };

  // Group items by date
  const groupedItems = items.reduce((groups, item) => {
    const dateKey = new Date(item.date).toLocaleDateString('es-DO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(item);
    return groups;
  }, {});

  const periodTotal = items.reduce((sum, e) => sum + e.amount, 0);

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
            <h1>{mainTab === 'expenses' ? 'Tus gastos' : 'Tus ingresos'}</h1>
          </div>
        </div>
        <div className="month-total">
          <span className="month-total-label">
            {mainTab === 'expenses' ? 'Total gastos' : 'Total ingresos'}
          </span>
          <span
            className="month-total-amount"
            style={{ color: mainTab === 'incomes' ? '#10B981' : undefined }}
          >
            {mainTab === 'incomes' ? '+' : ''}
            {periodTotal.toLocaleString('es-DO', {
              style: 'currency',
              currency: 'DOP',
            })}
          </span>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="button"
              className="btn-header-action"
              onClick={() => setShowExport(true)}
              title="Exportar a Excel o PDF"
            >
              <Download size={13} />
              <span>Exportar</span>
            </button>
            {mainTab === 'expenses' && (
              <button
                type="button"
                className="btn-header-action"
                onClick={() => setShowImport(true)}
                title="Importar desde extracto bancario o captura de pantalla"
              >
                <Sparkles size={13} />
                <span>Importar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Switcher: Gastos vs Ingresos */}
      <div className="category-type-tabs" style={{ margin: '0 20px 12px' }}>
        <button
          className={`cat-type-tab ${mainTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setMainTab('expenses')}
        >
          <Receipt size={16} />
          <span>Gastos</span>
        </button>
        <button
          className={`cat-type-tab ${mainTab === 'incomes' ? 'active' : ''}`}
          onClick={() => setMainTab('incomes')}
          style={mainTab === 'incomes' ? { borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.18)' } : undefined}
        >
          <Wallet size={16} />
          <span>Ingresos</span>
        </button>
      </div>

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

      {/* List */}
      <div className="expense-list">
        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">{mainTab === 'expenses' ? '📝' : '💰'}</span>
            <p>{mainTab === 'expenses' ? 'No hay gastos aún' : 'No hay ingresos registrados'}</p>
            <p className="empty-sub">
              {mainTab === 'expenses'
                ? 'Toca el botón + para registrar tu primer gasto'
                : 'Toca el botón + para registrar tu primer ingreso'}
            </p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([date, groupItems]) => (
            <div key={date} className="expense-group">
              <span className="group-date">{date}</span>
              <div className="group-items">
                {groupItems.map((item) =>
                  mainTab === 'expenses' ? (
                    <ExpenseCard
                      key={item.id}
                      expense={item}
                      onEdit={handleEdit}
                      onDelete={(e) => setDeletingItem(e)}
                    />
                  ) : (
                    <IncomeCard
                      key={item.id}
                      income={item}
                      onEdit={handleEdit}
                      onDelete={(i) => setDeletingItem(i)}
                    />
                  )
                )}
              </div>
            </div>
          ))
        )}

        {/* Google AdSense Banner */}
        <AdBanner className="expenses-ad-banner" />
      </div>

      {/* Floating Add Button */}
      <button
        className="fab"
        onClick={openNew}
        aria-label={mainTab === 'expenses' ? 'Agregar gasto' : 'Agregar ingreso'}
        id="add-item-fab"
        style={mainTab === 'incomes' ? { background: '#10B981', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)' } : undefined}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {/* Expense Form Sheet */}
      {showForm && mainTab === 'expenses' && (
        <ExpenseForm
          expense={editingItem}
          categories={categories}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Income Form Sheet */}
      {showForm && mainTab === 'incomes' && (
        <IncomeForm
          income={editingItem}
          categories={categories}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Bulk Import Center */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        categories={categories}
        onImportSuccess={fetchData}
      />

      {/* Export Report Modal */}
      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />

      {/* Confirm Delete Dialog */}
      {deletingItem && (
        <ConfirmDialog
          title={mainTab === 'expenses' ? '¿Eliminar gasto?' : '¿Eliminar ingreso?'}
          message={`¿Estás seguro de que deseas eliminar "${deletingItem.description}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          danger={true}
          onConfirm={handleDelete}
          onCancel={() => setDeletingItem(null)}
        />
      )}
    </div>
  );
}
