import { Check, X } from 'lucide-react';
import './PasswordStrengthMeter.css';

export const evaluatePassword = (password = '') => {
  const rules = [
    { id: 'length', label: 'Mínimo 8 caracteres', passed: password.length >= 8 },
    { id: 'upper', label: 'Al menos una mayúscula', passed: /[A-Z]/.test(password) },
    { id: 'lower', label: 'Al menos una minúscula', passed: /[a-z]/.test(password) },
    { id: 'number', label: 'Al menos un número', passed: /[0-9]/.test(password) },
    { id: 'special', label: 'Al menos un carácter especial (@, $, !, %, etc.)', passed: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ];

  const passedCount = rules.filter(r => r.passed).length;
  let level = 'empty';
  let label = '';

  if (password.length > 0) {
    if (passedCount <= 2) {
      level = 'weak';
      label = 'Débil';
    } else if (passedCount <= 4) {
      level = 'medium';
      label = 'Media';
    } else {
      level = 'strong';
      label = 'Fuerte (Recomendada)';
    }
  }

  const isValid = passedCount === 5;

  return { rules, passedCount, level, label, isValid };
};

export default function PasswordStrengthMeter({ password = '', showRules = true }) {
  if (!password) return null;

  const { rules, level, label, passedCount } = evaluatePassword(password);

  return (
    <div className="pwd-strength-container">
      <div className="pwd-strength-header">
        <span className="pwd-strength-title">Seguridad de la contraseña:</span>
        <span className={`pwd-strength-label ${level}`}>{label}</span>
      </div>

      <div className="pwd-strength-track">
        <div
          className={`pwd-strength-bar ${level}`}
          style={{ width: `${(passedCount / 5) * 100}%` }}
        />
      </div>

      {showRules && (
        <ul className="pwd-rules-list">
          {rules.map((rule) => (
            <li key={rule.id} className={`pwd-rule-item ${rule.passed ? 'passed' : 'failed'}`}>
              {rule.passed ? (
                <Check size={13} className="rule-icon success" />
              ) : (
                <X size={13} className="rule-icon fail" />
              )}
              <span>{rule.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
