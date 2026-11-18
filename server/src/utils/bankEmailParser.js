/**
 * Bank and Financial Email Parser
 * Tailored exclusively for bank debit/consumption notifications:
 * - Banreservas (notificaciones@banreservas.com)
 * - Banco Popular Dominicano (notificaciones@popularenlinea.com)
 * - Other Dominican banks (BHD, Scotiabank, Qik, APAP)
 */

/**
 * Standardizes raw amount strings like "1,500.50", "2.350,00", "50.00", "100.00" into a float.
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
  // If comma is decimal separator (e.g., 50,00)
  else if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }

  const val = parseFloat(str);
  return isNaN(val) || val <= 0 ? null : Math.round(val * 100) / 100;
}

/**
 * Standardizes DD/MM/YYYY date strings into Date objects
 */
function parseDateString(rawDate) {
  if (!rawDate) return new Date();
  const match = String(rawDate).match(/(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b)/);
  if (!match) return new Date();

  const parts = match[1].split(/[\/\-\.]/);
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
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  return new Date();
}

/**
 * Cleans extracted merchant name by removing trailing prepositions/punctuation.
 */
function cleanMerchantName(merchant) {
  if (!merchant) return null;
  let m = merchant.trim().replace(/\s+/g, ' ');
  // Remove HTML residue if any
  m = m.replace(/<[^>]*>?/gm, '');
  // Remove starting/trailing prepositions or noise
  m = m.replace(/^(en\s+|el\s+|la\s+|los\s+|las\s+|comercio\s*:\s*)/i, '');
  // Strip trailing metadata (Fecha de transaccion, Numero de aprobacion, etc.)
  m = m.replace(/\s*(?:Fecha\s*de\s*transacci[oó]n|N[uú]mero\s*de\s*aprobaci[oó]n|Recibido\s*por).*$/i, '');
  m = m.replace(/\s+(el|la|por|con|para|a\s+las|su|tu)$/i, '');
  m = m.replace(/[.,:;*#-]+$/, '').trim();
  return m.length >= 2 ? m : null;
}

/**
 * Parses email subject and body strictly for bank transaction notifications.
 * Discards promotions, marketing, and non-expense emails.
 */
function parseBankEmail({ subject = '', bodyText = '', bodyHtml = '', from = '', date = null }) {
  const cleanFrom = String(from).toLowerCase();
  const fullRaw = `${subject}\n${bodyText}\n${bodyHtml ? bodyHtml.replace(/<[^>]*>?/gm, ' ') : ''}`;
  const normalized = fullRaw.replace(/\r\n/g, '\n').replace(/\s+/g, ' ');

  // 1. Strict Promotion / Marketing Filter
  const isPromo = /(?:promoci[oó]n|cup[oó]n|c[oó]digo promocional|descuento exclusivo|ahorra en tu pr[oó]ximo|viaja con descuento|aprovecha el descuento|gana hasta|invita a tus amigos)/i.test(normalized);
  if (isPromo) {
    return null; // Explicitly discard promotions
  }

  // ─── BANRESERVAS PARSER ──────────────────────────────────────────────
  if (cleanFrom.includes('banreservas') || /banreservas/i.test(normalized)) {
    const isApproved = /APROBADO|Aprobada/i.test(normalized);
    const isConsumption = /notificaci[oó]n de consumo|presenta un consumo/i.test(normalized);

    if (isApproved || isConsumption) {
      // Find Monto
      const montoMatch = normalized.match(/Monto\s*:\s*(?:DOP|RD\$|\$)?\s*([0-9.,]+)/i) ||
                         normalized.match(/(?:DOP|RD\$|\$)\s*([0-9.,]+)/i);

      // Find Comercio
      const comercioMatch = normalized.match(/Comercio\s*:\s*([A-Za-z0-9\s\.\-_&'#]{2,50}?)(?:\s+Fecha|\s+N[uú]mero|\s+Estado|\s*[\n\r]|$)/i) ||
                            normalized.match(/Comercio\s*:\s*([^\n\r]+)/i);

      // Find Fecha
      const fechaMatch = normalized.match(/Fecha(?:\s+de\s+transacci[oó]n)?\s*:\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i) ||
                         normalized.match(/([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i);

      if (montoMatch && montoMatch[1]) {
        const amount = cleanNumericAmount(montoMatch[1]);
        const merchant = comercioMatch ? cleanMerchantName(comercioMatch[1]) : 'Consumo Banreservas';
        const expenseDate = fechaMatch ? parseDateString(fechaMatch[1]) : (date ? new Date(date) : new Date());

        if (amount && amount > 0) {
          return {
            amount,
            currency: 'DOP',
            merchant: merchant || 'Consumo Banreservas',
            date: expenseDate,
            paymentMethod: 'Banreservas',
            parsedBy: 'banreservas-template',
          };
        }
      }
    }
  }

  // ─── BANCO POPULAR DOMINICANO PARSER ────────────────────────────────
  if (cleanFrom.includes('popularenlinea') || cleanFrom.includes('bancopopular') || /banco popular/i.test(normalized)) {
    const isApproved = /Aprobada|Aprobado/i.test(normalized);

    if (isApproved) {
      // 1. Table format in HTML (if bodyHtml is provided)
      if (bodyHtml) {
        const rows = bodyHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
        if (rows && rows.length >= 2) {
          for (const row of rows) {
            if (/Aprobada|Aprobado/i.test(row)) {
              const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]*>?/gm, '').trim());
              // Cells expected: [Monto, Moneda, Fecha, Comercio, Estatus]
              if (cells.length >= 4) {
                const amount = cleanNumericAmount(cells[0].replace(/[^0-9.,]/g, ''));
                const expenseDate = parseDateString(cells[2]);
                const merchant = cleanMerchantName(cells[3]);

                if (amount && amount > 0) {
                  return {
                    amount,
                    currency: /USD|D[oó]lar/i.test(cells[1]) ? 'USD' : 'DOP',
                    merchant: merchant || 'Consumo Banco Popular',
                    date: expenseDate,
                    paymentMethod: 'Banco Popular',
                    parsedBy: 'popular-html-table',
                  };
                }
              }
            }
          }
        }
      }

      // 2. Table format in Plain Text / Normalized Text
      // e.g.: RD$100.00 Peso dominicano 16/11/2026 RUTH SNACK VM Aprobada
      const tableMatch = normalized.match(/(?:RD\$|DOP|US\$|USD)\s*([0-9.,]+)\s+(?:Peso dominicano|DOP|USD|Dólar[a-z]*)?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(.+?)\s+(?:Aprobada|Aprobado)/i);

      if (tableMatch && tableMatch[1]) {
        const amount = cleanNumericAmount(tableMatch[1]);
        const expenseDate = parseDateString(tableMatch[2]);
        const merchant = cleanMerchantName(tableMatch[3]);

        if (amount && amount > 0) {
          return {
            amount,
            currency: /USD|D[oó]lar/i.test(tableMatch[0]) ? 'USD' : 'DOP',
            merchant: merchant || 'Consumo Banco Popular',
            date: expenseDate,
            paymentMethod: 'Banco Popular',
            parsedBy: 'popular-text-table',
          };
        }
      }

      // 3. Fallback: Search individual fields
      const montoMatch = normalized.match(/(?:RD\$|DOP|US\$|USD)\s*([0-9.,]+)/i);
      const merchantMatch = normalized.match(/(?:Fecha\s+Comercio\s+Estatus|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(.+?)\s+Aprobada/i);
      const fechaMatch = normalized.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);

      if (montoMatch && montoMatch[1]) {
        const amount = cleanNumericAmount(montoMatch[1]);
        const merchant = merchantMatch ? cleanMerchantName(merchantMatch[1]) : 'Consumo Banco Popular';
        const expenseDate = fechaMatch ? parseDateString(fechaMatch[1]) : (date ? new Date(date) : new Date());

        if (amount && amount > 0) {
          return {
            amount,
            currency: /USD|D[oó]lar/i.test(normalized) ? 'USD' : 'DOP',
            merchant: merchant || 'Consumo Banco Popular',
            date: expenseDate,
            paymentMethod: 'Banco Popular',
            parsedBy: 'popular-flexible',
          };
        }
      }
    }
  }

  // ─── OTHER DOMINICAN BANKS (BHD, Scotiabank, Qik, APAP) ────────────
  const otherBanks = [
    { name: 'Banco BHD', pattern: /bhd\.com\.do|bhdleon|banco bhd/i },
    { name: 'Scotiabank', pattern: /scotiabank/i },
    { name: 'Qik Banco Digital', pattern: /qik\.do|qik banco/i },
    { name: 'APAP', pattern: /apap\.com\.do|asociacion popular/i },
  ];

  for (const b of otherBanks) {
    if (b.pattern.test(cleanFrom) || b.pattern.test(normalized)) {
      const isApproved = /aprobad[oa]|realizada|consumo exitoso|d[eé]bito aplicado/i.test(normalized);
      if (!isApproved) continue;

      const amtMatch = normalized.match(/(?:monto|valor|por|compra aprobada por)\s*:?\s*(?:RD\$|DOP|US\$|USD|\$)?\s*([0-9]{1,3}(?:[,\.][0-9]{3})*(?:[,\.][0-9]{1,2})|[0-9]+(?:[,\.][0-9]{1,2})?)/i);
      const merchMatch = normalized.match(/\ben\s+([A-Za-z][A-Za-z0-9\s\.\-_&'#]{2,40}?)(?:\s+(?:el\s+\d|con\s+(?:su|tu)|por\s+un)|\s*[.,:\n<]|$)/i);

      if (amtMatch && amtMatch[1]) {
        const amount = cleanNumericAmount(amtMatch[1]);
        if (amount && amount > 0) {
          return {
            amount,
            currency: /US\$|USD/i.test(normalized) ? 'USD' : 'DOP',
            merchant: merchMatch ? cleanMerchantName(merchMatch[1]) : `Consumo ${b.name}`,
            date: date ? new Date(date) : new Date(),
            paymentMethod: b.name,
            parsedBy: 'generic-bank-template',
          };
        }
      }
    }
  }

  return null;
}

module.exports = {
  parseBankEmail,
  cleanNumericAmount,
};
