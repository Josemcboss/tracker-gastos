/**
 * Smart CSV and OCR Text Parser for Expense Import
 */

const KEYWORD_MAP = {
  Comida: [
    'uber eats', 'pedidosya', 'mcdonald', 'burger king', 'kfc', 'wendy',
    'restaurante', 'restaurant', 'cafe', 'coffee', 'starbucks', 'pizza',
    'colmado', 'supermercado', 'bravo', 'nacional', 'sirena', 'jumbo',
    'carrefour', 'bakery', 'panaderia', 'sushi', 'taco', 'bar', 'food',
    'helad', 'dunkin', 'baskin', 'pasteleria', 'almuerzo', 'cena', 'hot dog', 'vending'
  ],
  Transporte: [
    'uber', 'didi', 'cabify', 'taxi', 'metro', 'peaje', 'estacionamiento',
    'parqueo', 'gasolina', 'combustible', 'gasolinera', 'texaco', 'shell',
    'total', 'totalenergies', 'esso', 'sunix', 'isla', 'ecopetroleo', 'cometa', 'delta', 'vuelo'
  ],
  Entretenimiento: [
    'netflix', 'spotify', 'apple', 'apple.com', 'youtube', 'disney', 'hbo', 'max',
    'prime video', 'twitch', 'cine', 'caribbean cinemas', 'palacio del cine',
    'steam', 'playstation', 'psn', 'xbox', 'nintendo'
  ],
  Salud: [
    'farmacia', 'carol', 'gbc', 'hidalgo', 'los hidalgos', 'laboratorio',
    'clinica', 'hospital', 'dentista', 'odontolog', 'medico', 'optica'
  ],
  Vivienda: [
    'claro', 'altice', 'edenorte', 'edesur', 'edeeste', 'caasd', 'coraasan',
    'condominio', 'mantenimiento', 'alquiler', 'renta', 'ikea', 'ferreteria',
    'electricidad'
  ],
  Educación: [
    'udemy', 'coursera', 'platzi', 'universidad', 'colegio', 'escuela',
    'instituto', 'libros', 'libreria', 'kindle'
  ],
};

export function autoCategorizeMerchant(merchant = '', categories = []) {
  if (!categories.length) return null;
  const clean = merchant.toLowerCase().trim();

  // 1. Direct name match
  for (const cat of categories) {
    if (clean.includes(cat.name.toLowerCase())) return cat.id;
  }

  // 2. Keyword group lookup
  for (const [groupName, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(k => clean.includes(k))) {
      const match = categories.find(c => c.name.toLowerCase() === groupName.toLowerCase());
      if (match) return match.id;
    }
  }

  // 3. Fallback to Otros or first category
  const otros = categories.find(c => c.name.toLowerCase() === 'otros');
  return otros ? otros.id : categories[0].id;
}

/**
 * Robust CSV row splitter that preserves content inside quotes
 */
export function splitCSVRow(line = '', delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

/**
 * Parses numbers with comma or dot decimals and currency symbols
 */
export function parseNumber(raw) {
  if (raw === undefined || raw === null) return NaN;
  let str = raw.toString().trim().replace(/[^\d.,-]/g, '');
  if (!str) return NaN;

  // Handle formats like 1,250.50 vs 1.250,50
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // European/Spanish: 1.250,50 -> 1250.50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US/DR standard: 1,250.50 -> 1250.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts[1] && parts[1].length === 2) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(',', '');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? NaN : Math.abs(num);
}

/**
 * Parses dates into standard YYYY-MM-DD
 */
export function parseDateStr(raw) {
  if (!raw) return new Date().toISOString().split('T')[0];
  const clean = raw.toString().trim().replace(/^["']|["']$/g, '');

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Parses bank CSV statements (Banco Popular, BHD, Banreservas, Chase, Apple Card, etc.)
 */
export function parseCSV(csvContent = '', categories = []) {
  // Strip null bytes (0x00) and UTF-16 padding from Excel CSV exports
  const cleanContent = (csvContent || '').replace(/[\0\u0000]/g, '');
  const lines = cleanContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const delimiters = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let headerLineIdx = -1;
  let maxScore = -1;
  let detectedHeaders = [];

  const keywords = [
    'fecha', 'date', 'fec', 'concepto', 'desc', 'detalle', 'comercio',
    'establecimiento', 'merchant', 'memo', 'monto', 'debito', 'débito',
    'cargo', 'retiro', 'importe', 'amount', 'valor', 'saldo', 'balance', 'tipo'
  ];

  // Scan the first 15 lines for the real table header row
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    for (const d of delimiters) {
      const parts = splitCSVRow(lines[i], d).map(p => p.toLowerCase());
      const score = parts.filter(p => keywords.some(k => p.includes(k))).length;
      if (score > maxScore && score >= 2) {
        maxScore = score;
        headerLineIdx = i;
        bestDelimiter = d;
        detectedHeaders = parts;
      }
    }
  }

  if (headerLineIdx === -1) {
    headerLineIdx = 0;
    bestDelimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
    detectedHeaders = splitCSVRow(lines[0], bestDelimiter).map(p => p.toLowerCase());
  }

  let dateIdx = detectedHeaders.findIndex(h => h.includes('fecha') || h.includes('date'));
  let descIdx = detectedHeaders.findIndex(h => h.includes('desc') || h.includes('concepto') || h.includes('detalle') || h.includes('comercio') || h.includes('merchant'));
  let debitIdx = detectedHeaders.findIndex(h => h.includes('debito') || h.includes('débito') || h.includes('cargo') || h.includes('retiro'));
  let amountIdx = detectedHeaders.findIndex(h => h.includes('monto') || h.includes('importe') || h.includes('amount') || h.includes('valor'));
  let creditIdx = detectedHeaders.findIndex(h => h.includes('credito') || h.includes('crédito') || h.includes('abono') || h.includes('deposito') || h.includes('depósito'));
  let typeIdx = detectedHeaders.findIndex(h => h.includes('tipo') || h.includes('type'));

  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = 1;
  if (amountIdx === -1 && debitIdx !== -1) amountIdx = debitIdx;
  if (amountIdx === -1) amountIdx = 2;

  const expenses = [];

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const row = splitCSVRow(lines[i], bestDelimiter);
    if (row.length <= Math.max(dateIdx, descIdx)) continue;

    // Filter out credit/deposits if separate debit/credit columns exist
    if (debitIdx !== -1 && creditIdx !== -1) {
      const debitVal = parseNumber(row[debitIdx]);
      if (isNaN(debitVal) || debitVal <= 0) {
        continue;
      }
    } else if (typeIdx !== -1) {
      const typeVal = (row[typeIdx] || '').toLowerCase();
      if (typeVal.includes('cr') || typeVal.includes('cred') || typeVal.includes('abono') || typeVal.includes('deposito')) {
        continue;
      }
    }

    const rawDesc = row[descIdx] || 'Gasto importado';
    const rawAmt = (amountIdx !== -1 && row[amountIdx]) ? row[amountIdx] : (debitIdx !== -1 ? row[debitIdx] : '0');
    const amount = parseNumber(rawAmt);

    if (isNaN(amount) || amount <= 0) continue;

    const dateStr = parseDateStr(row[dateIdx]);

    expenses.push({
      id: `imp_${Date.now()}_${i}`,
      description: rawDesc,
      amount: Math.round(amount * 100) / 100,
      date: dateStr,
      categoryId: autoCategorizeMerchant(rawDesc, categories),
      paymentMethod: 'Importación CSV',
      selected: true,
    });
  }

  return expenses;
}

/**
 * Parses OCR extracted text lines from Apple Wallet or bank screenshots
 */
export function parseOCRText(text = '', categories = []) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];

  // Patterns for amounts: "DOP 4,500.00", "RD$ 325.00", "$4.65", "375.00", etc.
  const amountRegex = /(?:DOP|RD\$|\$)?\s*([0-9]{1,3}(?:[,.][0-9]{3})*(?:[.,][0-9]{2}))|(?:DOP|RD\$|\$)\s*([0-9]+(?:\.[0-9]{2})?)/i;

  let currentMerchant = '';
  let currentDate = new Date().toISOString().split('T')[0];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ignore UI header lines
    if (/Latest Transactions|Transacciones|Done|Listo|Search|Buscar/i.test(line)) continue;

    // Check if line contains a date like 9/18/26, 18/09/2026, Yesterday, Ayer, etc.
    const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (dateMatch) {
      const parts = dateMatch[1].split('/');
      let parsedD;
      if (parts[2].length === 2) {
        parsedD = new Date(`20${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
      } else {
        parsedD = new Date(dateMatch[1]);
      }
      if (!isNaN(parsedD.getTime())) {
        currentDate = parsedD.toISOString().split('T')[0];
      }
    }

    // Check if line has an amount
    const match = line.match(amountRegex);
    if (match) {
      const rawNumStr = (match[1] || match[2] || '').replace(/,/g, '');
      const parsedAmount = parseFloat(rawNumStr);

      if (!isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount < 10000000) {
        // Line may also contain merchant name
        let merchant = line.replace(match[0], '').replace(/[><]/g, '').trim();
        if (!merchant && currentMerchant) {
          merchant = currentMerchant;
        } else if (!merchant && i > 0) {
          merchant = lines[i - 1].replace(/[><]/g, '').trim();
        }

        if (!merchant) merchant = 'Transacción detectada';

        // USD conversion heuristic: if amount < 30 and had "$" without DOP, convert to DOP ~60
        let finalAmount = parsedAmount;
        if (line.includes('$') && !line.includes('DOP') && !line.includes('RD$') && parsedAmount < 30) {
          finalAmount = Math.round(parsedAmount * 60 * 100) / 100;
        }

        items.push({
          id: `ocr_${Date.now()}_${items.length}`,
          description: merchant,
          amount: Math.round(finalAmount * 100) / 100,
          date: currentDate,
          categoryId: autoCategorizeMerchant(merchant, categories),
          paymentMethod: 'Apple Wallet (OCR)',
          selected: true,
        });

        currentMerchant = '';
        continue;
      }
    }

    // Likely a merchant line
    if (line.length > 2 && !/^\d+$/.test(line)) {
      currentMerchant = line;
    }
  }

  return items;
}
