import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  LogOut,
  Calendar,
  Coins,
  Receipt,
  Tags,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../services/api';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ expensesCount: 0, categoriesCount: 0 });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const [expData, catData] = await Promise.all([
          api.getExpenses(),
          api.getCategories(),
        ]);
        setStats({
          expensesCount: expData.total || expData.expenses?.length || 0,
          categoriesCount: catData.length || 0,
        });
      } catch {
        // Silently continue if stats fail
      }
    };
    fetchUserStats();
  }, []);

  const handleLogout = () => {
    logout();
    showToast('Sesión cerrada correctamente');
    navigate('/login');
  };

  const getInitial = (name) => {
    if (!name) return 'U';
    return name.trim().charAt(0).toUpperCase();
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('es-DO', {
        month: 'long',
        year: 'numeric',
      })
    : 'Recientemente';

  return (
    <div className="page profile-page">
      {/* Header */}
      <header className="page-header profile-header">
        <div>
          <span className="greeting">Mi Cuenta</span>
          <h1>Perfil de Usuario</h1>
        </div>
      </header>

      {/* User Hero Card */}
      <div className="profile-hero-card">
        <div className="avatar-circle">
          <span>{getInitial(user?.name)}</span>
        </div>
        <div className="profile-hero-info">
          <h2>{user?.name || 'Usuario'}</h2>
          <p className="profile-email">{user?.email}</p>
          <div className="profile-badge">
            <ShieldCheck size={14} />
            <span>Cuenta Activa</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="profile-stats-grid">
        <div className="profile-stat-box">
          <div className="stat-icon-wrap purple">
            <Receipt size={20} />
          </div>
          <div className="stat-meta">
            <span className="stat-value">{stats.expensesCount}</span>
            <span className="stat-label">Gastos Registrados</span>
          </div>
        </div>
        <div className="profile-stat-box">
          <div className="stat-icon-wrap violet">
            <Tags size={20} />
          </div>
          <div className="stat-meta">
            <span className="stat-value">{stats.categoriesCount}</span>
            <span className="stat-label">Categorías</span>
          </div>
        </div>
      </div>

      {/* Account Info Group */}
      <div className="profile-group">
        <h3 className="profile-group-title">Detalles de la cuenta</h3>
        <div className="profile-group-card">
          <div className="profile-row">
            <div className="profile-row-left">
              <User size={18} className="row-icon" />
              <span>Nombre</span>
            </div>
            <span className="profile-row-value">{user?.name}</span>
          </div>
          <div className="profile-row">
            <div className="profile-row-left">
              <Mail size={18} className="row-icon" />
              <span>Correo</span>
            </div>
            <span className="profile-row-value">{user?.email}</span>
          </div>
          <div className="profile-row">
            <div className="profile-row-left">
              <Coins size={18} className="row-icon" />
              <span>Moneda</span>
            </div>
            <span className="profile-row-value">Peso Dominicano (RD$)</span>
          </div>
          <div className="profile-row">
            <div className="profile-row-left">
              <Calendar size={18} className="row-icon" />
              <span>Miembro desde</span>
            </div>
            <span className="profile-row-value">{memberSince}</span>
          </div>
        </div>
      </div>

      {/* Multi-account Actions */}
      <div className="profile-group">
        <h3 className="profile-group-title">Sesión y Multiusuario</h3>
        <div className="profile-group-card">
          <button
            className="profile-action-btn"
            onClick={() => setShowLogoutConfirm(true)}
            id="btn-switch-account"
          >
            <div className="action-btn-left">
              <UserPlus size={18} className="action-icon text-purple" />
              <span>Cambiar o crear otra cuenta</span>
            </div>
          </button>
          <button
            className="profile-action-btn danger-action"
            onClick={() => setShowLogoutConfirm(true)}
            id="btn-logout"
          >
            <div className="action-btn-left">
              <LogOut size={18} className="action-icon text-danger" />
              <span>Cerrar sesión</span>
            </div>
          </button>
        </div>
      </div>

      {/* Confirm Logout Dialog */}
      {showLogoutConfirm && (
        <ConfirmDialog
          title="¿Cerrar sesión?"
          message="Podrás volver a ingresar en cualquier momento con tu correo y contraseña, o crear una cuenta nueva."
          confirmText="Cerrar sesión"
          danger={true}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}
