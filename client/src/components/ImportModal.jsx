import { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Camera,
  Check,
  Trash2,
  Sparkles,
  ArrowRight,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import api from '../services/api';
import { parseCSV, parseOCRText } from '../utils/importParser';
import { useToast } from '../context/ToastContext';
import './ImportModal.css';

export default function ImportModal({ isOpen, onClose, categories = [], onImportSuccess }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState('ocr'); // 'ocr' | 'csv'
  const [loading, setLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedExpenses, setExtractedExpenses] = useState([]);
  const [csvText, setCsvText] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  if (!isOpen) return null;

  // ── OCR Processing with Tesseract ──────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setOcrProgress(10);
    try {
      const worker = await createWorker('spa+eng');
      setOcrProgress(35);

      const ret = await worker.recognize(file);
      setOcrProgress(80);

      await worker.terminate();
      setOcrProgress(100);

      const items = parseOCRText(ret.data.text, categories);
      if (items.length === 0) {
        showToast('No se detectaron transacciones claras en la imagen. Intenta con una captura más nítida.', 'error');
      } else {
        setExtractedExpenses(items);
        showToast(`¡Se detectaron ${items.length} gastos en la captura!`);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      showToast('Error al analizar la imagen: ' + (err.message || 'error desconocido'), 'error');
    } finally {
      setLoading(false);
      setOcrProgress(0);
    }
  };

  // ── CSV Processing ─────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const items = parseCSV(content, categories);
      if (items.length === 0) {
        showToast('No se pudieron leer gastos del archivo. Verifica el formato CSV.', 'error');
      } else {
        setExtractedExpenses(items);
        showToast(`¡Se encontraron ${items.length} gastos en el archivo CSV!`);
      }
    };
    reader.readAsText(file);
  };

  const handleParseManualCsv = () => {
    if (!csvText.trim()) return;
    const items = parseCSV(csvText, categories);
    if (items.length === 0) {
      showToast('No se detectaron transacciones válidas en el texto pegado.', 'error');
    } else {
      setExtractedExpenses(items);
      showToast(`¡Se encontraron ${items.length} gastos!`);
    }
  };

  // ── Item update handlers ───────────────────────────────────────────
  const toggleSelect = (id) => {
    setExtractedExpenses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItem = (id, field, value) => {
    setExtractedExpenses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (id) => {
    setExtractedExpenses((prev) => prev.filter((item) => item.id !== id));
  };

  // ── Save to DB ────────────────────────────────────────────────────
  const handleConfirmImport = async () => {
    const selected = extractedExpenses.filter((i) => i.selected);
    if (selected.length === 0) {
      showToast('Selecciona al menos un gasto para importar.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = selected
        .map((item) => {
          let validDate = new Date();
          if (item.date) {
            const d = new Date(item.date);
            if (!isNaN(d.getTime())) validDate = d;
          }
          return {
            amount: parseFloat(item.amount) || 0,
            description: (item.description || 'Gasto importado').trim(),
            date: validDate.toISOString(),
            categoryId: item.categoryId || categories[0]?.id,
            paymentMethod: item.paymentMethod || 'Importación',
          };
        })
        .filter((i) => i.amount > 0);

      if (payload.length === 0) {
        showToast('No hay gastos con montos válidos para importar.', 'error');
        return;
      }

      const res = await api.bulkCreateExpenses(payload);
      showToast(`✅ ¡${res.count || payload.length} gastos importados exitosamente!`);
      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (err) {
      showToast(err.message || 'Error al guardar los gastos importados', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = extractedExpenses.filter((i) => i.selected).length;
  const totalAmount = extractedExpenses
    .filter((i) => i.selected)
    .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="import-modal-header">
          <div>
            <h3>Centro de Importación</h3>
            <p className="import-modal-sub">
              Carga tus gastos desde capturas de pantalla o extractos bancarios
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="import-tabs">
          <button
            className={`import-tab-btn ${tab === 'ocr' ? 'active' : ''}`}
            onClick={() => {
              setTab('ocr');
              setExtractedExpenses([]);
            }}
          >
            <Camera size={16} />
            <span>Captura de Pantalla (OCR)</span>
          </button>
          <button
            className={`import-tab-btn ${tab === 'csv' ? 'active' : ''}`}
            onClick={() => {
              setTab('csv');
              setExtractedExpenses([]);
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Archivo CSV / Banco</span>
          </button>
        </div>

        {/* Upload Zone */}
        {extractedExpenses.length === 0 ? (
          <div className="import-dropzone-container">
            {tab === 'ocr' ? (
              <div
                className="import-dropzone"
                onClick={() => !loading && imageInputRef.current?.click()}
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={imageInputRef}
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                  disabled={loading}
                />
                <div className="dropzone-icon-wrap">
                  <Camera size={32} className="text-purple" />
                </div>
                <h4>Sube tu captura de pantalla de Apple Wallet</h4>
                <p>Toma un screenshot a la lista de compras de tu iPhone o app de banco y súbelo aquí</p>
                <button type="button" className="btn-browse" disabled={loading}>
                  {loading ? `Analizando texto (${ocrProgress}%)...` : 'Seleccionar Imagen'}
                </button>
                {loading && (
                  <div className="ocr-progress-bar">
                    <div className="ocr-progress-fill" style={{ width: `${ocrProgress}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="csv-upload-wrapper">
                <div
                  className="import-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    accept=".csv, .txt"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <div className="dropzone-icon-wrap">
                    <FileSpreadsheet size={32} className="text-purple" />
                  </div>
                  <h4>Sube tu archivo CSV o Excel exportado</h4>
                  <p>Compatible con Banco Popular, BHD, Banreservas, Scotiabank y más</p>
                  <button type="button" className="btn-browse">
                    Seleccionar Archivo CSV
                  </button>
                </div>

                <div className="csv-manual-paste">
                  <span className="or-divider">o pega el texto del extracto aquí:</span>
                  <textarea
                    className="csv-textarea"
                    placeholder="Fecha, Concepto, Monto&#10;2026-09-18, Texaco Gasolina, 1000&#10;2026-09-17, Supermercado Bravo, 216"
                    rows={4}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-parse-text"
                    onClick={handleParseManualCsv}
                    disabled={!csvText.trim()}
                  >
                    <span>Analizar Texto</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Extracted Preview List */
          <div className="import-preview-container">
            <div className="preview-top-bar">
              <div className="preview-counter">
                <strong>{selectedCount}</strong> de {extractedExpenses.length} seleccionados
                <span className="preview-total-badge">
                  Total: RD$ {totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <button
                type="button"
                className="btn-reset-preview"
                onClick={() => setExtractedExpenses([])}
              >
                Cargar otra imagen/archivo
              </button>
            </div>

            <div className="preview-table-wrap">
              {extractedExpenses.map((item) => (
                <div key={item.id} className={`preview-row ${!item.selected ? 'dimmed' : ''}`}>
                  <input
                    type="checkbox"
                    className="preview-check"
                    checked={item.selected}
                    onChange={() => toggleSelect(item.id)}
                  />
                  <div className="preview-inputs">
                    <input
                      type="text"
                      className="preview-input desc"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Descripción"
                    />
                    <div className="preview-sub-inputs">
                      <div className="input-dop-prefix">
                        <span>RD$</span>
                        <input
                          type="number"
                          step="0.01"
                          className="preview-input amount"
                          value={item.amount}
                          onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                        />
                      </div>
                      <input
                        type="date"
                        className="preview-input date"
                        value={item.date}
                        onChange={(e) => updateItem(item.id, 'date', e.target.value)}
                      />
                      <select
                        className="preview-select category"
                        value={item.categoryId || ''}
                        onChange={(e) => updateItem(item.id, 'categoryId', e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-row"
                    onClick={() => removeItem(item.id)}
                    title="Eliminar fila"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="import-modal-footer">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setExtractedExpenses([])}
                disabled={saving}
              >
                Volver
              </button>
              <button
                type="button"
                className="modal-btn-submit"
                onClick={handleConfirmImport}
                disabled={saving || selectedCount === 0}
              >
                {saving ? 'Importando...' : `Confirmar e Importar (${selectedCount})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
