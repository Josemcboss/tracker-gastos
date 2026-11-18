/**
 * Intelligent Fallback Parser using Google Gemini API
 * Used when regular expressions cannot decipher complex or non-standard email structures.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * Parses raw email text or html using Gemini API
 * @param {object} params
 * @param {string} params.subject
 * @param {string} params.bodyText
 * @param {string} [params.from]
 * @returns {Promise<object|null>} Extracted transaction details
 */
async function parseWithGemini({ subject = '', bodyText = '', from = '' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = `
Analiza el siguiente correo electrónico bancario o recibo de compra y extrae los datos de la transacción en formato JSON estricto.

Correo:
De: ${from}
Asunto: ${subject}
Contenido:
${bodyText.slice(0, 3000)}

Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (sin formato Markdown, sin comillas triples):
{
  "amount": <número flotante mayor a 0, ej: 1500.50>,
  "currency": <"DOP" o "USD">,
  "merchant": <nombre del comercio o establecimiento, ej: "Supermercado Bravo", "Uber", etc.>,
  "date": <fecha en formato "YYYY-MM-DD", o fecha actual si no se menciona>,
  "suggestedCategory": <una de: "Comida", "Transporte", "Entretenimiento y Subscripciones", "Salud", "Vivienda", "Educación", "Otros">
}

Si el correo NO es una notificación de gasto, compra o débito bancario, responde:
{ "isExpense": false }
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      console.warn(`Gemini API Error: Status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText.trim());

    if (parsed.isExpense === false || !parsed.amount || isNaN(parsed.amount) || parsed.amount <= 0) {
      return null;
    }

    let parsedDate = new Date();
    if (parsed.date) {
      const d = new Date(parsed.date);
      if (!isNaN(d.getTime())) parsedDate = d;
    }

    return {
      amount: Math.round(parseFloat(parsed.amount) * 100) / 100,
      currency: parsed.currency === 'USD' ? 'USD' : 'DOP',
      merchant: (parsed.merchant || 'Gasto Analizado por IA').slice(0, 100),
      date: parsedDate,
      paymentMethod: from ? `Correo (${from.slice(0, 30)})` : 'Correo Electrónico (IA)',
      suggestedCategory: parsed.suggestedCategory || null,
      parsedBy: 'gemini',
    };
  } catch (error) {
    console.error('Gemini Parser Error:', error.message);
    return null;
  }
}

module.exports = {
  parseWithGemini,
};
