import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check, Wallet, Receipt } from 'lucide-react';
import { getIcon, AVAILABLE_ICONS } from '../utils/icons';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../services/api';
import './CategoriesPage.css';

const PRESET_COLORS = [
  '#8B5CF6', '#10B981', '#3B82F6', '#F59E0B',
  '#A78BFA', '#C4B5FD', '#D946EF', '#F472B6',
  '#6D28D9', '#52525B', '#34D399', '#FBBF24',
  '#F87171', '#60A5FA', '#818CF8', '#14B8A6',
];

export default function CategoriesPage() {
  const { showToast } = useToast();
  const [typeTab, setTypeTab] = useState('expenses'); // 'expenses' | 'incomes'
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#8B5CF6',
    icon: 'tag',
  });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      if (typeTab === 'expenses') {
        const data = await api.getCategories();
        setCategories(data);
      } else {
        const data = await api.getIncomeCategories();
        setCategories(data);
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [typeTab]);

  const openNew = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      color: typeTab === 'expenses' ? '#8B5CF6' : '#10B981',
      icon: typeTab === 'expenses' ? 'tag' : 'wallet',
    });
    setShowForm(true);
  };

  const openEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, color: cat.color, icon: cat.icon });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (typeTab === 'expenses') {
        if (editingCategory) {
          await api.updateCategory(editingCategory.id, formData);
          showToast('Categoría de gasto actualizada ✓');
        } else {
          await api.createCategory(formData);
          showToast('Categoría de gasto creada ✓');
        }
      } else {
        if (editingCategory) {
          await api.updateIncomeCategory(editingCategory.id, formData);
          showToast('Categoría de ingreso actualizada ✓');
        } else {
          await api.createIncomeCategory(formData);
          showToast('Categoría de ingreso creada ✓');
        }
      }
      setShowForm(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleDelete = async () => {
    try {
      if (typeTab === 'expenses') {
        await api.deleteCategory(deletingCategory.id);
      } else {
        await api.deleteIncomeCategory(deletingCategory.id);
      }
      showToast('Categoría eliminada');
      setDeletingCategory(null);
      fetchCategories();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="page categories-page">
      <header className="page-header single categories-header">
        <h1>Categorías</h1>
        <button className="header-btn" onClick={openNew} id="add-category-btn">
          <Plus size={18} />
          <span>Nueva</span>
        </button>
      </header>

      {/* Type Switcher: Gastos vs Ingresos */}
      <div className="category-type-tabs">
        <button
          className={`cat-type-tab ${typeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setTypeTab('expenses')}
        >
          <Receipt size={16} />
          <span>Gastos</span>
        </button>
        <button
          className={`cat-type-tab ${typeTab === 'incomes' ? 'active' : ''}`}
          onClick={() => setTypeTab('incomes')}
        >
          <Wallet size={16} />
          <span>Ingresos</span>
        </button>
      </div>

      <div className="categories-list">
        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🏷️</span>
            <p>No hay categorías registradas</p>
          </div>
        ) : (
          categories.map((cat) => {
            const Icon = getIcon(cat.icon);
            return (
              <div key={cat.id} className="category-item">
                <div className="category-item-left">
                  <div
                    className="category-icon-wrapper"
                    style={{ backgroundColor: `${cat.color}1A` }}
                  >
                    <Icon size={20} color={cat.color} strokeWidth={1.8} />
                  </div>
                  <div className="category-info">
                    <span className="category-name">{cat.name}</span>
                    {cat.isDefault && (
                      <span className="default-badge">Predefinida</span>
                    )}
                  </div>
                </div>
                <div className="category-actions">
                  <button
                    className="action-btn"
                    onClick={() => openEdit(cat)}
                    aria-label="Editar categoría"
                  >
                    <Pencil size={15} />
                  </button>
                  {!cat.isDefault && (
                    <button
                      className="action-btn delete"
                      onClick={() => setDeletingCategory(cat)}
                      aria-label="Eliminar categoría"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="form-overlay" onClick={() => setShowForm(false)}>
          <div className="form-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="form-header">
              <h2>
                {editingCategory
                  ? `Editar categoría de ${typeTab === 'expenses' ? 'gasto' : 'ingreso'}`
                  : `Nueva categoría de ${typeTab === 'expenses' ? 'gasto' : 'ingreso'}`}
              </h2>
              <button
                className="form-close"
                onClick={() => setShowForm(false)}
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="cat-name">Nombre</label>
                <input
                  id="cat-name"
                  type="text"
                  placeholder="Ej: Salario, Alquiler, Gym..."
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="form-input"
                  required
                  autoFocus
                />
              </div>

              {/* Color picker */}
              <div className="form-group">
                <label>Color</label>
                <div className="color-grid">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch ${formData.color === c ? 'selected' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, color: c }))
                      }
                    >
                      {formData.color === c && <Check size={16} color="#FFF" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon selector */}
              <div className="form-group">
                <label>Ícono</label>
                <div className="icon-grid">
                  {AVAILABLE_ICONS.map((name) => {
                    const IconComp = getIcon(name);
                    const isSelected = formData.icon === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`icon-option ${isSelected ? 'selected' : ''}`}
                        style={isSelected ? { backgroundColor: formData.color, borderColor: formData.color } : {}}
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, icon: name }))
                        }
                      >
                        <IconComp size={20} color={isSelected ? '#FFF' : undefined} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="form-submit"
                style={{
                  backgroundColor: formData.color,
                }}
              >
                {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {deletingCategory && (
        <ConfirmDialog
          title="¿Eliminar categoría?"
          message={`¿Estás seguro de que deseas eliminar "${deletingCategory.name}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          danger={true}
          onConfirm={handleDelete}
          onCancel={() => setDeletingCategory(null)}
        />
      )}
    </div>
  );
}
