const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Recursively convert snake_case object/array keys to camelCase
function snakeToCamel(obj) {
  if (Array.isArray(obj)) {
    return obj.map(v => snakeToCamel(v));
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = snakeToCamel(obj[key]);
      return result;
    }, {});
  }
  return obj;
}

// Recursively convert camelCase object/array keys to snake_case
function camelToSnake(obj) {
  if (Array.isArray(obj)) {
    return obj.map(v => camelToSnake(v));
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = camelToSnake(obj[key]);
      return result;
    }, {});
  }
  return obj;
}

// Base Fetch Wrapper
async function apiFetch(endpoint, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 3000); // 3s timeout for API readiness check

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(id);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }
    const data = await response.json();
    return snakeToCamel(data);
  } catch (err) {
    clearTimeout(id);
    console.warn(`[AssetFlow API] Connection to ${endpoint} failed. Reverting to local storage.`, err.message);
    throw err;
  }
}

export const api = {
  // Test connection
  checkConnection: async () => {
    try {
      await fetch(`${API_BASE_URL}/assets`, { method: 'HEAD', mode: 'cors' });
      return true;
    } catch {
      return false;
    }
  },

  // Assets
  getAssets: () => apiFetch('/assets'),
  createAsset: (asset) => apiFetch('/assets', { method: 'POST', body: JSON.stringify(camelToSnake(asset)) }),
  updateAsset: (id, fields) => apiFetch(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(camelToSnake(fields)) }),
  deleteAsset: (id) => apiFetch(`/assets/${id}`, { method: 'DELETE' }),

  // AMCs
  getAmcs: () => apiFetch('/amcs'),
  createAmc: (amc) => apiFetch('/amcs', { method: 'POST', body: JSON.stringify(camelToSnake(amc)) }),
  updateAmc: (id, fields) => apiFetch(`/amcs/${id}`, { method: 'PATCH', body: JSON.stringify(camelToSnake(fields)) }),

  // Invoices
  getInvoices: () => apiFetch('/invoices'),
  createInvoice: (invoice) => apiFetch('/invoices', { method: 'POST', body: JSON.stringify(camelToSnake(invoice)) }),
  updateInvoice: (id, fields) => apiFetch(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(camelToSnake(fields)) }),

  // Movements
  getMovements: () => apiFetch('/movements'),
  createMovement: (movement) => apiFetch('/movements', { method: 'POST', body: JSON.stringify(camelToSnake(movement)) }),

  // Documents
  getDocuments: () => apiFetch('/documents'),
  createDocument: (doc) => apiFetch('/documents', { method: 'POST', body: JSON.stringify(camelToSnake(doc)) }),

  // Logs
  getLogs: () => apiFetch('/logs'),
  createLog: (log) => apiFetch('/logs', { method: 'POST', body: JSON.stringify(camelToSnake(log)) }),

  // Notifications
  getNotifications: () => apiFetch('/notifications'),
  createNotification: (notif) => apiFetch('/notifications', { method: 'POST', body: JSON.stringify(camelToSnake(notif)) }),
  markNotificationRead: (id, read) => apiFetch(`/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ read }) }),
  markAllNotificationsRead: () => apiFetch('/notifications', { method: 'PATCH' }),

  // Emails
  getEmails: () => apiFetch('/emails'),

  // Users
  getUsers: () => apiFetch('/users'),
  createUser: (user) => apiFetch('/users', { method: 'POST', body: JSON.stringify(user) }),

  // Upload File
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }
      const data = await response.json();
      return snakeToCamel(data);
    } catch (err) {
      console.error("[AssetFlow API] File upload failed", err);
      throw err;
    }
  },
};
