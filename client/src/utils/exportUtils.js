/**
 * Export financial data to Excel / CSV with UTF-8 BOM for Microsoft Excel compatibility
 */
export function exportToCSV(expenses = [], incomes = [], periodTitle = 'Reporte') {
  const BOM = '\uFEFF';
  let csv = BOM;

  // Header Summary
  const totalExp = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalInc = incomes.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const balance = totalInc - totalExp;

  csv += `INFORME FINANCIERO PERSONAL - ${periodTitle.toUpperCase()}\n`;
  csv += `Fecha de generación: ${new Date().toLocaleDateString('es-DO', { dateStyle: 'long' })}\n\n`;

  csv += `RESUMEN GENERAL\n`;
  csv += `Total Ingresos,RD$ ${totalInc.toFixed(2)}\n`;
  csv += `Total Gastos,RD$ ${totalExp.toFixed(2)}\n`;
  csv += `Balance Neto,RD$ ${balance.toFixed(2)}\n\n`;

  // Expenses Section
  csv += `DETALLE DE GASTOS (${expenses.length})\n`;
  csv += `Fecha,Descripción,Categoría,Método de Pago,Monto (DOP)\n`;
  expenses.forEach((e) => {
    const dateStr = new Date(e.date).toLocaleDateString('es-DO');
    const desc = `"${(e.description || '').replace(/"/g, '""')}"`;
    const cat = `"${(e.category?.name || 'General').replace(/"/g, '""')}"`;
    const method = `"${(e.paymentMethod || 'No especificado').replace(/"/g, '""')}"`;
    const amt = (parseFloat(e.amount) || 0).toFixed(2);
    csv += `${dateStr},${desc},${cat},${method},${amt}\n`;
  });

  csv += `\n`;

  // Incomes Section
  if (incomes.length > 0) {
    csv += `DETALLE DE INGRESOS (${incomes.length})\n`;
    csv += `Fecha,Descripción,Categoría,Fuente,Monto (DOP)\n`;
    incomes.forEach((i) => {
      const dateStr = new Date(i.date).toLocaleDateString('es-DO');
      const desc = `"${(i.description || '').replace(/"/g, '""')}"`;
      const cat = `"${(i.category?.name || 'General').replace(/"/g, '""')}"`;
      const source = `"${(i.source || 'No especificada').replace(/"/g, '""')}"`;
      const amt = (parseFloat(i.amount) || 0).toFixed(2);
      csv += `${dateStr},${desc},${cat},${source},${amt}\n`;
    });
  }

  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Reporte_Financiero_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate an Executive Printable PDF Report in high vector quality
 */
export function exportToPDF({
  periodTitle = 'Este Mes',
  expenses = [],
  incomes = [],
  userName = 'Usuario',
}) {
  const totalExp = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalInc = incomes.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const balance = totalInc - totalExp;

  // Group expenses by category
  const catMap = {};
  expenses.forEach((e) => {
    const cName = e.category?.name || 'Otros';
    const cColor = e.category?.color || '#8B5CF6';
    if (!catMap[cName]) catMap[cName] = { total: 0, color: cColor, count: 0 };
    catMap[cName].total += parseFloat(e.amount) || 0;
    catMap[cName].count += 1;
  });

  const catRows = Object.entries(catMap)
    .sort((a, b) => b[1].total - a[1].total)
    .map(
      ([name, data]) => `
      <tr>
        <td>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${data.color};margin-right:8px;"></span>
          <strong>${name}</strong> (${data.count} gastos)
        </td>
        <td style="text-align:right;">${totalExp > 0 ? ((data.total / totalExp) * 100).toFixed(1) : 0}%</td>
        <td style="text-align:right;font-weight:600;">RD$ ${data.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
      </tr>
    `
    )
    .join('');

  const expRows = expenses
    .slice(0, 50)
    .map(
      (e) => `
      <tr>
        <td>${new Date(e.date).toLocaleDateString('es-DO')}</td>
        <td><strong>${e.description}</strong></td>
        <td>${e.category?.name || 'General'}</td>
        <td>${e.paymentMethod || '—'}</td>
        <td style="text-align:right;font-weight:600;color:#DC2626;">RD$ ${(parseFloat(e.amount) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
      </tr>
    `
    )
    .join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor permite ventanas emergentes (pop-ups) para descargar el PDF.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Informe Financiero - ${periodTitle}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #1F2937;
          margin: 0;
          padding: 32px;
          background: #FFF;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #E5E7EB;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .logo {
          font-size: 24px;
          font-weight: 800;
          color: #7C3AED;
          letter-spacing: -0.5px;
        }
        .subtitle {
          font-size: 13px;
          color: #6B7280;
          margin-top: 4px;
        }
        .meta {
          text-align: right;
          font-size: 12px;
          color: #6B7280;
        }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }
        .card {
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 16px;
        }
        .card-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6B7280;
          margin-bottom: 6px;
        }
        .card-val {
          font-size: 20px;
          font-weight: 700;
        }
        .text-green { color: #059669; }
        .text-red { color: #DC2626; }
        .text-purple { color: #7C3AED; }
        h3 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin-top: 24px;
          margin-bottom: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: 24px;
        }
        th {
          background: #F3F4F6;
          text-align: left;
          padding: 10px 12px;
          font-weight: 600;
          color: #4B5563;
          border-bottom: 1px solid #E5E7EB;
        }
        td {
          padding: 10px 12px;
          border-bottom: 1px solid #F3F4F6;
        }
        .footer {
          margin-top: 40px;
          border-top: 1px solid #E5E7EB;
          padding-top: 16px;
          font-size: 11px;
          color: #9CA3AF;
          text-align: center;
        }
        @media print {
          body { padding: 16px; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">Gastos • Tracker Financiero</div>
          <div class="subtitle">Informe Ejecutivo de Movimientos — <strong>${periodTitle}</strong></div>
        </div>
        <div class="meta">
          <div><strong>Titular:</strong> ${userName}</div>
          <div><strong>Generado:</strong> ${new Date().toLocaleDateString('es-DO', { dateStyle: 'medium' })}</div>
        </div>
      </div>

      <div class="cards-grid">
        <div class="card">
          <div class="card-label">Total Ingresos</div>
          <div class="card-val text-green">RD$ ${totalInc.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Gastos</div>
          <div class="card-val text-red">RD$ ${totalExp.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="card">
          <div class="card-label">Balance Neto</div>
          <div class="card-val text-purple">RD$ ${balance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <h3>Distribución por Categorías</h3>
      <table>
        <thead>
          <tr>
            <th>Categoría</th>
            <th style="text-align:right;">Participación</th>
            <th style="text-align:right;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${catRows || '<tr><td colspan="3">Sin gastos en este periodo.</td></tr>'}
        </tbody>
      </table>

      <h3>Detalle de Transacciones (Últimos ${Math.min(expenses.length, 50)})</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Descripción</th>
            <th>Categoría</th>
            <th>Método</th>
            <th style="text-align:right;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${expRows || '<tr><td colspan="5">Sin transacciones registradas.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        Documento generado automáticamente por Gastos Tracker. Los datos son confidenciales y para uso personal.
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
