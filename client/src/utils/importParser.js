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
 * Parses CSV text into expense objects
 */
export function parseCSV(csvContent = '', categories = []) {
  const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

  const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

  // Detect column indices
  let dateIdx = headers.findIndex(h => h.includes('fecha') || h.includes('date'));
  let descIdx = headers.findIndex(h => h.includes('desc') || h.includes('concepto') || h.includes('comercio') || h.includes('detalle') || h.includes('merchant'));
  let amountIdx = headers.findIndex(h => h.includes('monto') || h.includes('importe') || h.includes('debito') || h.includes('amount') || h.includes('valor'));

  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = 1;
  if (amountIdx === -1) amountIdx = 2;

  const expenses = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map(col => col.trim().replace(/^["']|["']$/g, ''));
    if (row.length <= Math.max(dateIdx, descIdx, amountIdx)) continue;

    const rawDesc = row[descIdx] || 'Gasto importado';
    const rawAmount = row[amountIdx] || '0';
    const rawDate = row[dateIdx] || '';

    // Clean amount (remove DOP, RD$, $, spaces)
    const cleanNum = rawAmount.replace(/[^\d.,-]/g, '').replace(/,/g, '.');
    const amount = Math.abs(parseFloat(cleanNum));

    if (isNaN(amount) || amount <= 0) continue;

    let date = new Date();
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }

    expenses.push({
      id: `imp_${Date.now()}_${i}`,
      description: rawDesc,
      amount: Math.round(amount * 100) / 100,
      date: date.toISOString().split('T')[0],
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
