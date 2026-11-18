/**
 * Bank and Financial Email Parser
 * Tailored for Dominican banks (Banco Popular, Banreservas, BHD, Scotiabank, APAP, Qik)
 * as well as digital services (Uber, PedidosYa, Apple, Amazon, PayPal).
 */

const DOMINICAN_BANKS = [
  { name: 'Banco Popular', domain: 'bancopopular.com.do' },
  { name: 'Banreservas', domain: 'banreservas.com.do' },
  { name: 'Banco BHD', domain: 'bhd.com.do' },
  { name: 'Scotiabank', domain: 'scotiabank.com.do' },
  { name: 'Qik Banco Digital', domain: 'qik.do' },
  { name: 'APAP', domain: 'apap.com.do' },
];

/**
 * Standardizes raw amount strings like "1,500.50", "2.350,00", "450" into a float.
 */
function cleanNumericAmount(rawStr) {
  if (!rawStr) return null;
  let str = String(rawStr).trim();

  // If format is 1,234.56
  if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(str)) {
    str = str.replace(/,/g, '');
  }
  // If format is 1.234,56
  else if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  // If comma is decimal separator (e.g., 450,50)
  else if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }

  const val = parseFloat(str);
  return isNaN(val) || val <= 0 ? null : Math.round(val * 100) / 100;
}

/**
 * Cleans extracted merchant name by removing trailing prepositions/punctuation.
 */
function cleanMerchantName(merchant) {
  if (!merchant) return null;
  let m = merchant.trim().replace(/\s+/g, ' ');
  // Remove starting/trailing noise
  m = m.replace(/^(en\s+|el\s+|la\s+|los\s+|las\s+)/i, '');
  m = m.replace(/\s+(el|la|por|con|para|a\s+las|su|tu)$/i, '');
  m = m.replace(/[.,:;*#-]+$/, '').trim();
  return m.length >= 2 ? m : null;
}

/**
 * Parses email subject and body using rule-based heuristics and regex.
 *
 * @param {object} params
 * @param {string} params.subject - Email subject
 * @param {string} params.bodyText - Plain text or HTML stripped text
 * @param {string} params.from - Sender email or display name
 * @param {string} [params.date] - Optional date string
 * @returns {object|null} { amount, currency, merchant, date, confidence, paymentMethod }
 */
function parseBankEmail({ subject = '', bodyText = '', from = '', date = null }) {
  const fullText = `${subject}\n${bodyText}`.replace(/\r\n/g, '\n');
  const cleanFrom = String(from).toLowerCase();

  let detectedCurrency = 'DOP';
  let detectedAmount = null;
  let detectedMerchant = null;
  let detectedDate = date ? new Date(date) : new Date();
  let paymentMethod = 'Notificación por Correo';

  // Identify institution from sender or content
  for (const bank of DOMINICAN_BANKS) {
    if (cleanFrom.includes(bank.domain) || fullText.toLowerCase().includes(bank.name.toLowerCase())) {
      paymentMethod = bank.name;
      break;
    }
  }

  // Detect Currency
  if (/US\$|\bUSD\b|\bd[oó]lares\b/i.test(fullText)) {
    detectedCurrency = 'USD';
  } else if (/RD\$|\bDOP\b|\bpesos\b/i.test(fullText)) {
    detectedCurrency = 'DOP';
  }

  // 1. Amount Extraction (Ordered by specificity)
  const amountPatterns = [
    // Pattern 1: Explicit bank transaction expressions
    /(?:monto(?: de)?|valor(?: de)?|por un monto de|por valor de|compra aprobada por|importe(?: de)?|transacci[oó]n por|d[eé]bito por|cargo por)\s*:?\s*(?:de\s+)?(?:RD\$|DOP|US\$|USD|\$)?\s*([0-9]{1,3}(?:[,\.][0-9]{3})*(?:[,\.][0-9]{1,2})|[0-9]+(?:[,\.][0-9]{1,2})?)/i,
    // Pattern 2: Receipts / Invoices / Uber / PedidosYa
    /(?:total(?: pagado| a pagar| de la orden| del pedido)?|total)\s*:?\s*(?:RD\$|DOP|US\$|USD|\$)?\s*([0-9]{1,3}(?:[,\.][0-9]{3})*(?:[,\.][0-9]{1,2})|[0-9]+(?:[,\.][0-9]{1,2})?)/i,
    // Pattern 3: Currency prefix followed directly by digits: RD$ 1,500.00
    /(?:RD\$|US\$|USD|DOP)\s*([0-9]{1,3}(?:[,\.][0-9]{3})*(?:[,\.][0-9]{1,2})|[0-9]+(?:[,\.][0-9]{1,2})?)/i,
    // Pattern 4: Symbol $ followed by numbers
    /\$\s*([0-9]{1,3}(?:[,\.][0-9]{3})*(?:[,\.][0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/i,
  ];

  for (const pattern of amountPatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const parsed = cleanNumericAmount(match[1]);
      if (parsed && parsed > 0) {
        detectedAmount = parsed;
        break;
      }
    }
  }

  // 2. Merchant / Commerce Extraction
  // Digital apps quick check
  if (cleanFrom.includes('uber') || /recibo de uber|viaje con uber/i.test(subject)) {
    detectedMerchant = /eats/i.test(fullText) ? 'Uber Eats' : 'Uber';
  } else if (cleanFrom.includes('pedidosya') || /pedidosya/i.test(subject)) {
    detectedMerchant = 'PedidosYa';
  } else if (cleanFrom.includes('apple') || /recibo de apple/i.test(subject)) {
    detectedMerchant = 'Apple';
  } else if (cleanFrom.includes('amazon') || /pedido de amazon/i.test(subject)) {
    detectedMerchant = 'Amazon';
  } else if (cleanFrom.includes('netflix')) {
    detectedMerchant = 'Netflix';
  } else if (cleanFrom.includes('spotify')) {
    detectedMerchant = 'Spotify';
  }

  if (!detectedMerchant) {
    const merchantPatterns = [
      // "en COMERCIO el DD/MM" (ignoring "en 1234" or "en tarjeta")
      /\ben\s+([A-Za-z][A-Za-z0-9\s\.\-_&'#]{2,40}?)(?:\s+(?:el\s+\d|con\s+(?:su|tu)|por\s+un|a\s+las)|\s*[.,:\n<]|$)/i,
      // "Comercio: SUPERMERCADO BRAVO"
      /(?:comercio|establecimiento|negocio|proveedor|merchant|tienda)\s*:?\s*([A-Za-z0-9\s\.\-_&']{3,45})/i,
      // "Compra en COMERCIO"
      /(?:compra|consumo)\s+en\s+([A-Za-z][A-Za-z0-9\s\.\-_&'#]{2,40})/i,
    ];

    for (const pattern of merchantPatterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        const candidate = cleanMerchantName(match[1]);
        if (candidate) {
          const lower = candidate.toLowerCase();
          const falsePositives = ['su tarjeta', 'su cuenta', 'efectivo', 'linea', 'canal digital', 'banco', 'popular', 'banreservas', 'bhd'];
          if (!falsePositives.some(f => lower.includes(f))) {
            detectedMerchant = candidate;
            break;
          }
        }
      }
    }
  }

  // Fallback merchant
  if (!detectedMerchant) {
    if (subject && subject.length <= 50) {
      detectedMerchant = cleanMerchantName(subject) || 'Gasto Notificado';
    } else {
      detectedMerchant = 'Gasto por Correo Electrónico';
    }
  }

  // 3. Date Extraction (e.g. 17/11/2026 or 2026-11-17)
  const dateMatch = fullText.match(/(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b)/);
  if (dateMatch && dateMatch[1]) {
    const parts = dateMatch[1].split(/[\/\-\.]/);
    if (parts.length === 3) {
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (m > 11 && d <= 12) {
        const temp = d;
        d = m + 1;
        m = temp - 1;
      }
      const parsedDate = new Date(y, m, d);
      if (!isNaN(parsedDate.getTime())) {
        detectedDate = parsedDate;
      }
    }
  }

  if (!detectedAmount) {
    return null; // Could not parse amount reliably
  }

  return {
    amount: detectedAmount,
    currency: detectedCurrency,
    merchant: detectedMerchant,
    date: detectedDate,
    paymentMethod,
    parsedBy: 'regex',
  };
}

module.exports = {
  parseBankEmail,
  cleanNumericAmount,
};
