const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem('pos_token');
}

function setToken(token) {
  if (token) localStorage.setItem('pos_token', token);
  else localStorage.removeItem('pos_token');
}

async function api(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}/api${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}
