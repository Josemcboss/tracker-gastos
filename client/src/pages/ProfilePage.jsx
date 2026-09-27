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
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import PasswordStrengthMeter, { evaluatePassword } from '../components/PasswordStrengthMeter';
import AppleWalletModal from '../components/AppleWalletModal';
import api from '../services/api';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ expensesCount: 0, categoriesCount: 0 });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Change password form state
  const [pwdData, setPwdData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPwd, setShowPwd] = useState({ current: false, next: false });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');

    if (pwdData.newPassword !== pwdData.confirmPassword) {
      setPwdError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    const evalResult = evaluatePassword(pwdData.newPassword);
    if (!evalResult.isValid) {
      setPwdError('La nueva contraseña no cumple con los requisitos de seguridad OWASP.');
      return;
    }

    setPwdLoading(true);
    try {
      await api.changePassword(pwdData.currentPassword, pwdData.newPassword);
      showToast('¡Contraseña actualizada exitosamente!');
      setShowPasswordModal(false);
      setPwdData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwdError(err.message || 'Error al actualizar contraseña.');
      showToast(err.message || 'Error al actualizar contraseña.', 'error');
    } finally {
      setPwdLoading(false);
    }
  };

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
            <span>Cuenta Verificada</span>
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

      {/* Integrations (Apple Wallet / Apple Pay) */}
      <div className="profile-group">
        <h3 className="profile-group-title">Integraciones</h3>
        <div className="profile-group-card">
          <button
            className="profile-action-btn"
            onClick={() => setShowWalletModal(true)}
            id="btn-open-apple-wallet"
          >
            <div className="action-btn-left">
              <CreditCard size={18} className="action-icon text-purple" />
              <span>Vincular Apple Wallet / Apple Pay</span>
            </div>
            <span className="badge-shortcut">Atajos iOS</span>
          </button>
        </div>
      </div>

      {/* Security & Protection (OWASP) */}
      <div className="profile-group">
        <h3 className="profile-group-title">Seguridad y Protección</h3>
        <div className="profile-group-card">
          <div className="profile-row">
            <div className="profile-row-left">
              <ShieldCheck size={18} className="row-icon text-purple" />
              <span>Seguridad de Sesión</span>
            </div>
            <span className="profile-row-value badge-secure">JWT Seguro (7 días)</span>
          </div>
          <div className="profile-row">
            <div className="profile-row-left">
              <Lock size={18} className="row-icon text-purple" />
              <span>Protección OWASP</span>
            </div>
            <span className="profile-row-value badge-secure">Activa (A01 - A10)</span>
          </div>
          <button
            className="profile-action-btn"
            onClick={() => {
              setPwdError('');
              setShowPasswordModal(true);
            }}
            id="btn-open-change-password"
          >
            <div className="action-btn-left">
              <KeyRound size={18} className="action-icon text-purple" />
              <span>Cambiar Contraseña</span>
            </div>
          </button>
        </div>
      </div>

      {/* Multi-account & Session Actions */}
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

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => !pwdLoading && setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <KeyRound size={20} className="text-purple" />
                <span>Actualizar Contraseña</span>
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowPasswordModal(false)}
                disabled={pwdLoading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="modal-form">
              <div className="modal-field">
                <label>Contraseña Actual</label>
                <div className="modal-input-wrap">
                  <input
                    type={showPwd.current ? 'text' : 'password'}
                    className="form-input"
                    value={pwdData.currentPassword}
                    onChange={(e) => setPwdData({ ...pwdData, currentPassword: e.target.value })}
                    required
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="modal-pwd-toggle"
                    onClick={() => setShowPwd((p) => ({ ...p, current: !p.current }))}
                  >
                    {showPwd.current ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="modal-field">
                <label>Nueva Contraseña</label>
                <div className="modal-input-wrap">
                  <input
                    type={showPwd.next ? 'text' : 'password'}
                    className="form-input"
                    value={pwdData.newPassword}
                    onChange={(e) => setPwdData({ ...pwdData, newPassword: e.target.value })}
                    required
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="modal-pwd-toggle"
                    onClick={() => setShowPwd((p) => ({ ...p, next: !p.next }))}
                  >
                    {showPwd.next ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PasswordStrengthMeter password={pwdData.newPassword} showRules={true} />
              </div>

              <div className="modal-field">
                <label>Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  value={pwdData.confirmPassword}
                  onChange={(e) => setPwdData({ ...pwdData, confirmPassword: e.target.value })}
                  required
                  placeholder="••••••••"
                />
              </div>

              {pwdError && (
                <div className="login-error-alert" role="alert">
                  <AlertCircle size={16} className="error-alert-icon" />
                  <span>{pwdError}</span>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={pwdLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="modal-btn-submit"
                  disabled={pwdLoading}
                >
                  {pwdLoading ? 'Guardando...' : 'Guardar Nueva Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apple Wallet Integration Modal */}
      <AppleWalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />

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
