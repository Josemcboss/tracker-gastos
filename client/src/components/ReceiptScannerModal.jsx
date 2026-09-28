import { useState, useRef } from 'react';
import { X, Camera, Upload, Sparkles, Check, AlertCircle, RefreshCw, DollarSign, Calendar, Tag } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { parseSingleReceiptText } from '../utils/importParser';
import { getIcon } from '../utils/icons';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './ReceiptScannerModal.css';

export default function ReceiptScannerModal({ isOpen, onClose, categories = [], onExpenseCreated }) {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [imagePreview, setImagePreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Generate local preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setExtractedData(null);
    await processReceipt(file);
  };

  const processReceipt = async (file) => {
    setScanning(true);
    setScanProgress(15);
    try {
      const worker = await createWorker('spa+eng');
      setScanProgress(40);

      const ret = await worker.recognize(file);
      setScanProgress(85);

      await worker.terminate();
      setScanProgress(100);

      const parsed = parseSingleReceiptText(ret.data.text, categories);

      if (!parsed || parsed.amount === 0) {
        showToast('⚠️ No se detectó un monto claro. Puedes ingresarlo manualmente.', 'warning');
      } else {
        showToast('✨ Factura analizada con éxito');
      }

      setExtractedData({
        amount: parsed?.amount ? String(parsed.amount) : '',
        description: parsed?.merchant || 'Gasto por recibo',
        date: parsed?.date || new Date().toISOString().split('T')[0],
        categoryId: parsed?.categoryId || categories[0]?.id || '',
        paymentMethod: 'Tarjeta débito',
      });
    } catch (err) {
      console.error('OCR Error:', err);
      showToast('Error al escanear: ' + (err.message || 'error desconocido'), 'error');
    } finally {
      setScanning(false);
      setScanProgress(0);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setExtractedData(null);
    setScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!extractedData.amount || !extractedData.description || !extractedData.categoryId) {
      showToast('Completa todos los campos obligatorios', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.createExpense({
        amount: parseFloat(extractedData.amount),
        description: extractedData.description.trim(),
        date: new Date(extractedData.date).toISOString(),
        categoryId: extractedData.categoryId,
        paymentMethod: extractedData.paymentMethod,
        currency: 'DOP',
        exchangeRate: 1,
      });

      showToast('🎉 Gasto guardado exitosamente');
      if (onExpenseCreated) onExpenseCreated();
      handleReset();
      onClose();
    } catch (err) {
      showToast(err.message || 'Error al guardar el gasto', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-sheet receipt-modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-header">
          <div className="receipt-header-title">
            <Sparkles size={22} className="text-purple" />
            <h2>Escáner de Recibos y Facturas</h2>
          </div>
          <button className="form-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <p className="receipt-subtitle">
          Toma una foto a tu factura o recibo. La IA extraerá el comercio, total y categoría automáticamente.
        </p>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* State 1: Upload / Camera picker */}
        {!imagePreview && (
          <div className="receipt-upload-box">
            <div className="receipt-dropzone" onClick={() => fileInputRef.current?.click()}>
              <div className="receipt-icon-circle">
                <Camera size={32} />
              </div>
              <h3>Toma una foto o sube tu factura</h3>
              <p>Formatos soportados: JPG, PNG, WebP de cualquier comprobante o ticket</p>
            </div>

            <div className="receipt-action-buttons">
              <button
                type="button"
                className="btn-receipt-action primary"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={18} />
                <span>Usar Cámara</span>
              </button>
              <button
                type="button"
                className="btn-receipt-action secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={18} />
                <span>Subir Archivo</span>
              </button>
            </div>
          </div>
        )}

        {/* State 2: Scanning in progress */}
        {imagePreview && scanning && (
          <div className="receipt-scanning-box">
            <div className="receipt-preview-wrap">
              <img src={imagePreview} alt="Recibo" className="receipt-preview-img" />
              <div className="receipt-laser-scan" />
            </div>
            <div className="receipt-scanning-status">
              <RefreshCw size={20} className="spin-icon text-purple" />
              <strong>Analizando recibo con IA... ({scanProgress}%)</strong>
              <p>Extrayendo comercio, fecha e importe total</p>
            </div>
          </div>
        )}

        {/* State 3: Extracted result preview & edit form */}
        {imagePreview && !scanning && extractedData && (
          <form onSubmit={handleSaveExpense} className="receipt-result-form">
            <div className="receipt-detected-banner">
              <Check size={18} color="#34D399" />
              <span>Datos detectados de la factura. Revisa y confirma:</span>
              <button type="button" className="btn-rescan" onClick={handleReset}>
                <RefreshCw size={13} />
                <span>Otra foto</span>
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="rec-amount">Monto Total Detectado (RD$)</label>
              <div className="input-with-icon">
                <DollarSign size={18} className="input-icon" />
                <input
                  id="rec-amount"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={extractedData.amount}
                  onChange={(e) => setExtractedData({ ...extractedData, amount: e.target.value })}
                  className="form-input"
                  required
                  autoFocus
                  inputMode="decimal"
                />
              </div>
              <div className="quick-amount-presets">
                {[100, 500, 1000, 2000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="quick-preset-btn"
                    onClick={() => {
                      const curr = parseFloat(extractedData.amount) || 0;
                      setExtractedData({ ...extractedData, amount: String(curr + val) });
                    }}
                  >
                    +{val.toLocaleString('es-DO')}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="rec-desc">Comercio / Descripción</label>
              <input
                id="rec-desc"
                type="text"
                value={extractedData.description}
                onChange={(e) => setExtractedData({ ...extractedData, description: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="rec-date">Fecha</label>
              <div className="input-with-icon">
                <Calendar size={18} className="input-icon" />
                <input
                  id="rec-date"
                  type="date"
                  value={extractedData.date}
                  onChange={(e) => setExtractedData({ ...extractedData, date: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Categoría</label>
              <div className="receipt-cat-chips">
                {categories.map((cat) => {
                  const Icon = getIcon(cat.icon);
                  const isSelected = extractedData.categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`budget-cat-chip ${isSelected ? 'selected' : ''}`}
                      style={isSelected ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                      onClick={() => setExtractedData({ ...extractedData, categoryId: cat.id })}
                    >
                      <Icon size={14} />
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="submit" className="form-submit" disabled={saving}>
              {saving ? 'Guardando Gasto...' : 'Guardar Gasto Escaneado'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
