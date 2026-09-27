import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { getIcon, AVAILABLE_ICONS } from '../utils/icons';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../services/api';
import './CategoriesPage.css';

const PRESET_COLORS = [
  '#8B5CF6', '#A78BFA', '#C4B5FD', '#D946EF',
  '#F472B6', '#6D28D9', '#52525B', '#34D399',
  '#FBBF24', '#F87171', '#60A5FA', '#818CF8',
];

export default function CategoriesPage() {
  const { showToast } = useToast();
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
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openNew = () => {
    setEditingCategory(null);
    setFormData({ name: '', color: '#8B5CF6', icon: 'tag' });
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
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, formData);
        showToast('Categoría actualizada ✓');
      } else {
        await api.createCategory(formData);
        showToast('Categoría creada ✓');
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
      await api.deleteCategory(deletingCategory.id);
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

      <div className="categories-list">
        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🏷️</span>
            <p>No hay categorías</p>
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
                    <Pencil size={16} />
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => setDeletingCategory(cat)}
                    aria-label="Eliminar categoría"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Category form modal */}
      {showForm && (
        <div className="form-overlay" onClick={() => setShowForm(false)}>
          <div className="form-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="form-header">
              <h2>
                {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
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
                  className="form-input"
                  placeholder="Nombre de la categoría"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Color</label>
                <div className="color-grid">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch ${formData.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    >
                      {formData.color === color && (
                        <Check size={16} color="white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Ícono</label>
                <div className="icon-grid">
                  {AVAILABLE_ICONS.map((iconName) => {
                    const IconComp = getIcon(iconName);
                    return (
                      <button
                        key={iconName}
                        type="button"
                        className={`icon-option ${formData.icon === iconName ? 'selected' : ''}`}
                        onClick={() =>
                          setFormData({ ...formData, icon: iconName })
                        }
                      >
                        <IconComp size={18} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="form-submit">
                {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingCategory && (
        <ConfirmDialog
          title="Eliminar categoría"
          message={`¿Eliminar "${deletingCategory.name}"? Si tiene gastos asociados, no se podrá eliminar.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingCategory(null)}
        />
      )}
    </div>
  );
}
