/**
 * Smart Auto-Categorization for Apple Wallet transactions
 * Maps merchant names and descriptions to matching user categories.
 */

const KEYWORD_MAP = {
  Comida: [
    'uber eats', 'pedidosya', 'mcdonald', 'burger king', 'kfc', 'wendy',
    'pizzarelli', 'pizza hut', 'dominos', 'restaurante', 'restaurant', 'cafe',
    'coffee', 'starbucks', 'pizza', 'colmado', 'supermercado', 'bravo', 'nacional',
    'sirena', 'jumbo', 'plaza lama', 'ole', 'carrefour', 'bakery', 'panaderia',
    'sushi', 'taco', 'bar', 'food', 'helad', 'dunkin', 'baskin', 'pasteleria',
    'almuerzo', 'cena', 'desayuno', 'comida'
  ],
  Transporte: [
    'uber', 'didi', 'cabify', 'taxi', 'metro', 'omsa', 'peaje', 'estacionamiento',
    'parqueo', 'gasolina', 'combustible', 'gasolinera', 'texaco', 'shell',
    'total', 'totalenergies', 'esso', 'sunix', 'isla', 'ecopetroleo', 'delta',
    'vuelo', 'aerolinea', 'avianca', 'mecanico', 'gomera'
  ],
  Entretenimiento: [
    'netflix', 'spotify', 'apple.com/bill', 'apple', 'youtube', 'disney', 'hbo', 'max',
    'prime video', 'twitch', 'cine', 'caribbean cinemas', 'palacio del cine',
    'steam', 'playstation', 'psn', 'xbox', 'nintendo', 'gaming', 'concierto',
    'gym', 'gimnasio', 'smart fit'
  ],
  Salud: [
    'farmacia', 'carol', 'gbc', 'hidalgo', 'los hidalgos', 'laboratorio',
    'clinica', 'hospital', 'dentista', 'odontolog', 'medico', 'optica', 'psicolog',
    'amadita', 'referencia'
  ],
  Vivienda: [
    'claro', 'altice', 'viva', 'edenorte', 'edesur', 'edeeste', 'caasd', 'coraasan',
    'condominio', 'mantenimiento', 'alquiler', 'renta', 'ikea', 'ferreteria',
    'bellon', 'amiga', 'electricidad', 'basura', 'americana'
  ],
  Educación: [
    'udemy', 'coursera', 'platzi', 'universidad', 'colegio', 'escuela',
    'instituto', 'libros', 'libreria', 'kindle', 'uasd', 'intec', 'pucmm', 'unibe'
  ],
};

/**
 * Finds the best matching category from user's categories based on merchant name.
 * @param {string} merchantName
 * @param {Array} userCategories
 * @returns {object} matched category or fallback
 */
function findBestCategory(merchantName = '', userCategories = []) {
  if (!merchantName || !userCategories.length) {
    return userCategories[0];
  }

  const cleanMerchant = merchantName.toLowerCase().trim();

  // 1. Direct name match (e.g. user has category named "Supermercado")
  for (const cat of userCategories) {
    if (cleanMerchant.includes(cat.name.toLowerCase())) {
      return cat;
    }
  }

  // 2. Keyword dictionary lookup
  for (const [groupName, keywords] of Object.entries(KEYWORD_MAP)) {
    const isKeywordMatch = keywords.some(k => cleanMerchant.includes(k));
    if (isKeywordMatch) {
      // Find user category matching groupName (or partial)
      const targetCat = userCategories.find(c =>
        c.name.toLowerCase() === groupName.toLowerCase() ||
        c.name.toLowerCase().includes(groupName.toLowerCase())
      );
      if (targetCat) return targetCat;
    }
  }

  // 3. Fallback to "Otros" category if available
  const otrosCat = userCategories.find(c => c.name.toLowerCase() === 'otros');
  if (otrosCat) return otrosCat;

  // 4. Default to first category
  return userCategories[0];
}

module.exports = {
  findBestCategory,
};
