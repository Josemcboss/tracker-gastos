/**
 * Real-time USD to DOP Exchange Rate Module
 * Caches daily rates with reliable fallback
 */

let cachedRate = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours cache
const FALLBACK_USD_TO_DOP = 60.50; // Dominican Republic current benchmark rate

/**
 * Gets current USD to DOP exchange rate
 * @returns {Promise<number>}
 */
async function getUsdToDopRate() {
  const now = Date.now();
  if (cachedRate && (now - lastFetchTime) < CACHE_DURATION_MS) {
    return cachedRate;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    // Free, no-auth public exchange rate API
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data?.rates?.DOP && typeof data.rates.DOP === 'number' && data.rates.DOP > 40) {
        cachedRate = Math.round(data.rates.DOP * 100) / 100;
        lastFetchTime = now;
        return cachedRate;
      }
    }
  } catch (error) {
    console.warn('Could not fetch live exchange rate, using benchmark fallback:', error.message);
  }

  return cachedRate || FALLBACK_USD_TO_DOP;
}

module.exports = {
  getUsdToDopRate,
  FALLBACK_USD_TO_DOP,
};
