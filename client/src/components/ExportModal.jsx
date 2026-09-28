import { useState } from 'react';
import { X, FileSpreadsheet, FileText, Download, Calendar, Check } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import './ExportModal.css';

export default function ExportModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [format, setFormat] = useState('excel'); // 'excel' | 'pdf'
  const [period, setPeriod] = useState('month'); // 'month' | '3months' | 'year' | 'all'
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      const now = new Date();
      let periodLabel = 'Este Mes';

      if (period === 'month') {
        params.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        params.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        periodLabel = 'Este Mes';
      } else if (period === '3months') {
        params.startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
        params.endDate = now.toISOString().split('T')[0];
        periodLabel = 'Últimos 3 Meses';
      } else if (period === 'year') {
        params.startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        params.endDate = now.toISOString().split('T')[0];
        periodLabel = `Año ${now.getFullYear()}`;
      } else {
        periodLabel = 'Historial Completo';
      }

      // Fetch expenses and incomes for the selected range
      const [expData, incData] = await Promise.all([
        api.getExpenses({ ...params, limit: 1000 }),
        api.getIncomes({ ...params, limit: 1000 }),
      ]);

      const expenses = expData.expenses || [];
      const incomes = incData.incomes || [];

      if (expenses.length === 0 && incomes.length === 0) {
        showToast('No hay transacciones registradas en el periodo seleccionado.', 'error');
        return;
      }

      if (format === 'excel') {
        exportToCSV(expenses, incomes, periodLabel);
        showToast('✅ Archivo Excel descargado exitosamente');
      } else {
        exportToPDF({
          periodTitle: periodLabel,
          expenses,
          incomes,
          userName: user?.name || 'Titular',
        });
        showToast('✅ Informe PDF generado');
      }

      onClose();
    } catch (err) {
      showToast(err.message || 'Error al exportar reporte', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-sheet export-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-header">
          <div className="export-title-wrap">
            <Download size={22} className="text-purple" />
            <h2>Exportar Reporte Financiero</h2>
          </div>
          <button className="form-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <p className="export-sub">
          Descarga tus movimientos en hoja de cálculo o genera un informe ejecutivo en PDF listo para imprimir.
        </p>

        {/* Format Selector */}
        <div className="export-section-group">
          <label className="export-group-label">Formato de descarga</label>
          <div className="export-format-grid">
            <button
              type="button"
              className={`export-format-card ${format === 'excel' ? 'selected' : ''}`}
              onClick={() => setFormat('excel')}
            >
              <div className="format-icon-box excel">
                <FileSpreadsheet size={24} />
              </div>
              <div className="format-card-info">
                <strong>Excel / CSV</strong>
                <span>Detalle tabular completo con todas las columnas</span>
              </div>
              {format === 'excel' && <Check size={18} className="format-check" />}
            </button>

            <button
              type="button"
              className={`export-format-card ${format === 'pdf' ? 'selected' : ''}`}
              onClick={() => setFormat('pdf')}
            >
              <div className="format-icon-box pdf">
                <FileText size={24} />
              </div>
              <div className="format-card-info">
                <strong>Informe Ejecutivo (PDF)</strong>
                <span>Resumen formateado con métricas y categorías</span>
              </div>
              {format === 'pdf' && <Check size={18} className="format-check" />}
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="export-section-group">
          <label className="export-group-label">Periodo a incluir</label>
          <div className="export-period-chips">
            <button
              type="button"
              className={`period-chip ${period === 'month' ? 'selected' : ''}`}
              onClick={() => setPeriod('month')}
            >
              Este mes
            </button>
            <button
              type="button"
              className={`period-chip ${period === '3months' ? 'selected' : ''}`}
              onClick={() => setPeriod('3months')}
            >
              Últimos 3 meses
            </button>
            <button
              type="button"
              className={`period-chip ${period === 'year' ? 'selected' : ''}`}
              onClick={() => setPeriod('year')}
            >
              Este año
            </button>
            <button
              type="button"
              className={`period-chip ${period === 'all' ? 'selected' : ''}`}
              onClick={() => setPeriod('all')}
            >
              Todo el historial
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          className="form-submit btn-export-action"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download size={18} />
          <span>{exporting ? 'Generando archivo...' : `Descargar ${format === 'excel' ? 'Excel (.csv)' : 'PDF'}`}</span>
        </button>
      </div>
    </div>
  );
}
