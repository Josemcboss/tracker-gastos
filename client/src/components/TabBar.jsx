import { useLocation, useNavigate } from 'react-router-dom';
import { Receipt, BarChart3, Tags } from 'lucide-react';
import './TabBar.css';

const tabs = [
  { path: '/',          label: 'Gastos',      icon: Receipt },
  { path: '/dashboard', label: 'Resumen',     icon: BarChart3 },
  { path: '/categories',label: 'Categorías',  icon: Tags },
];

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="tab-bar" id="main-tab-bar">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            className={`tab-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            id={`tab-${tab.label.toLowerCase()}`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.5} />
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
