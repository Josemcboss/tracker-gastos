import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PasswordStrengthMeter, { evaluatePassword } from '../components/PasswordStrengthMeter';
import './LoginPage.css';

export default function LoginPage() {
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (isRegister) {
      const evaluation = evaluatePassword(formData.password);
      if (!evaluation.isValid) {
        setErrorMessage('La contraseña no cumple con los requisitos mínimos de seguridad.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(formData.email, formData.password, formData.name);
        showToast('¡Cuenta creada exitosamente!');
      } else {
        await login(formData.email, formData.password);
        showToast('¡Bienvenido de vuelta!');
      }
    } catch (error) {
      setErrorMessage(error.message);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Brand */}
        <div className="login-brand">
          <div className="brand-icon">💸</div>
          <h1>Expense Tracker</h1>
          <p>Controla tus gastos con máxima seguridad</p>
        </div>

        {/* Toggle login / register */}
        <div className="login-toggle">
          <button
            className={`toggle-btn ${!isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(false);
              setErrorMessage('');
            }}
          >
            Iniciar sesión
          </button>
          <button
            className={`toggle-btn ${isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(true);
              setErrorMessage('');
            }}
          >
            Registrarse
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <div className="form-group">
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tu nombre"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required={isRegister}
                  maxLength={100}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                className="form-input"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                maxLength={255}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Contraseña"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {isRegister && (
              <PasswordStrengthMeter password={formData.password} showRules={true} />
            )}
          </div>

          {errorMessage && (
            <div className="login-error-alert" role="alert">
              <AlertCircle size={16} className="error-alert-icon" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            className="form-submit login-submit"
            disabled={loading}
            id="btn-login-submit"
          >
            {loading ? (
              <div className="loading-spinner small" />
            ) : isRegister ? (
              'Crear cuenta segura'
            ) : (
              'Iniciar sesión'
            )}
          </button>

          <div className="login-switch-prompt">
            {isRegister ? (
              <p>
                ¿Ya tienes una cuenta?{' '}
                <button
                  type="button"
                  className="switch-link-btn"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMessage('');
                  }}
                >
                  Inicia sesión
                </button>
              </p>
            ) : (
              <p>
                ¿No tienes una cuenta aún?{' '}
                <button
                  type="button"
                  className="switch-link-btn"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMessage('');
                  }}
                >
                  Regístrate gratis
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
