let envUrl = import.meta.env.VITE_API_URL || '/api';
if (envUrl.endsWith('/')) envUrl = envUrl.slice(0, -1);
if (envUrl.startsWith('http') && !envUrl.endsWith('/api')) {
  envUrl += '/api';
}
const API_BASE = envUrl;

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Auto-logout on 401 (excluding auth verification and integration tests)
    if (
      response.status === 401 &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/change-password') &&
      !endpoint.includes('/integrations/')
    ) {
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('Sesión expirada');
    }

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        throw new Error('Error al procesar la respuesta del servidor.');
      }
    } else {
      if (response.status === 404) {
        throw new Error('El servidor se está actualizando. Por favor intenta en unos segundos.');
      }
      if (response.status === 502 || response.status === 503) {
        throw new Error('El servidor en Render está iniciando. Por favor reintenta en unos segundos.');
      }
      throw new Error(`Error de conexión con el servidor (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(data?.error || 'Algo salió mal');
    }

    return data;
  }

  // ── Auth ──
  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email?.trim().toLowerCase(),
        password,
      }),
    });
  }

  register(email, password, name) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: email?.trim().toLowerCase(),
        password,
        name: name?.trim(),
      }),
    });
  }

  changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  getMe() {
    return this.request('/auth/me');
  }

  // ── Expenses ──
  getExpenses(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.set(k, v);
    });
    const qs = query.toString();
    return this.request(`/expenses${qs ? `?${qs}` : ''}`);
  }

  createExpense(data) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  bulkCreateExpenses(expenses) {
    return this.request('/expenses/bulk', {
      method: 'POST',
      body: JSON.stringify({ expenses }),
    });
  }

  updateExpense(id, data) {
    return this.request(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteExpense(id) {
    return this.request(`/expenses/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Categories ──
  getCategories() {
    return this.request('/categories');
  }

  createCategory(data) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateCategory(id, data) {
    return this.request(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteCategory(id) {
    return this.request(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Incomes ──
  getIncomes(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.set(k, v);
    });
    const qs = query.toString();
    return this.request(`/incomes${qs ? `?${qs}` : ''}`);
  }

  getIncomeSummary(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.set(k, v);
    });
    const qs = query.toString();
    return this.request(`/incomes/summary${qs ? `?${qs}` : ''}`);
  }

  createIncome(data) {
    return this.request('/incomes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateIncome(id, data) {
    return this.request(`/incomes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteIncome(id) {
    return this.request(`/incomes/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Income Categories ──
  getIncomeCategories() {
    return this.request('/income-categories');
  }

  createIncomeCategory(data) {
    return this.request('/income-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateIncomeCategory(id, data) {
    return this.request(`/income-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteIncomeCategory(id) {
    return this.request(`/income-categories/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Dashboard ──
  getSummary(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.set(k, v);
    });
    const qs = query.toString();
    return this.request(`/dashboard/summary${qs ? `?${qs}` : ''}`);
  }

  // ── Integrations (Apple Wallet, etc.) ──
  getIntegrationToken() {
    return this.request('/integrations/token');
  }

  regenerateIntegrationToken() {
    return this.request('/integrations/token/regenerate', {
      method: 'POST',
    });
  }

  // ── Budgets ──
  getBudgets() {
    return this.request('/budgets');
  }

  saveBudget(data) {
    return this.request('/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  deleteBudget(id) {
    return this.request(`/budgets/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Subscriptions ──
  getSubscriptions() {
    return this.request('/subscriptions');
  }

  createSubscription(data) {
    return this.request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateSubscription(id, data) {
    return this.request(`/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteSubscription(id) {
    return this.request(`/subscriptions/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Savings Goals ──
  getGoals() {
    return this.request('/goals');
  }

  createGoal(data) {
    return this.request('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  contributeToGoal(id, amount) {
    return this.request(`/goals/${id}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  deleteGoal(id) {
    return this.request(`/goals/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Telegram Integration ──
  getTelegramStatus() {
    return this.request('/integrations/telegram/status');
  }

  unlinkTelegram() {
    return this.request('/integrations/telegram/unlink', {
      method: 'POST',
    });
  }
}

const api = new ApiService();
export { API_BASE };
export default api;
