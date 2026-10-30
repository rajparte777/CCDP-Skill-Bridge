const API_BASE_URL = 'http://localhost:5000/api';

export function getToken() {
  const token = localStorage.getItem('devcollab_token');
  if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
    return null;
  }
  return token.trim();
}

export function setToken(token) {
  if (token && typeof token === 'string' && token !== 'null' && token !== 'undefined' && token.trim()) {
    localStorage.setItem('devcollab_token', token.trim());
  } else {
    localStorage.removeItem('devcollab_token');
  }
}

export function clearToken() {
  localStorage.removeItem('devcollab_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error?.message || 'An unexpected error occurred';
    const err = new Error(errorMsg);
    err.code = data?.error?.code || 'UNKNOWN_ERROR';
    err.status = response.status;
    err.details = data?.error?.details;
    throw err;
  }

  return data;
}

export const api = {
  get: (endpoint, headers = {}) => request(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers = {}) => request(endpoint, { method: 'POST', body: JSON.stringify(body), headers }),
  put: (endpoint, body, headers = {}) => request(endpoint, { method: 'PUT', body: JSON.stringify(body), headers }),
  delete: (endpoint, headers = {}) => request(endpoint, { method: 'DELETE', headers })
};
