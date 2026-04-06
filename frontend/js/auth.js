const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-display');

function setUserAvatar(user) {
  const el = document.getElementById('user-avatar');
  if (!el) return;
  if (!user) {
    el.textContent = '?';
    el.title = '';
    return;
  }
  const display = user.fullName || user.full_name || user.username || '?';
  const parts = String(display)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let initials;
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else {
    initials = String(parts[0] || '?')
      .slice(0, 2)
      .toUpperCase();
  }
  el.textContent = initials;
  el.title = `${user.username} · ${user.role}`;
}

// Role-based page access map
const PAGE_ACCESS = {
  admin:   ['pos', 'products', 'customers', 'sales', 'inventory', 'users', 'reports'],
  manager: ['pos', 'products', 'customers', 'sales', 'inventory', 'reports'],
  cashier: ['pos', 'sales'],
};

function canAccessPage(role, pageId) {
  const allowed = PAGE_ACCESS[role];
  return allowed ? allowed.includes(pageId) : false;
}
// Expose globally so app.js can enforce access on navigation
window.canAccessPage = canAccessPage;

function updateNavForRole(user) {
  const role = user && user.role;
  document.querySelectorAll('.nav-link').forEach(link => {
    const page = link.dataset.page;
    if (!page) return;
    link.hidden = !canAccessPage(role, page);
  });
}

function showLogin() {
  document.body.classList.remove('logged-in');
  if (loginScreen) loginScreen.hidden = false;
  if (appShell) appShell.hidden = true;
  updateNavForRole(null);
  setUserAvatar(null);
  setToken(null);
  var receiptModal = document.getElementById('receipt-modal');
  if (receiptModal) receiptModal.hidden = true;
}

function showApp(user) {
  document.body.classList.add('logged-in');
  if (loginScreen) loginScreen.hidden = true;
  if (appShell) appShell.hidden = false;
  window.currentUser = user;
  if (userDisplay) userDisplay.textContent = `${user.fullName || user.full_name || user.username} (${user.role})`;
  setUserAvatar(user);
  updateNavForRole(user);
}

async function checkAuth() {
  const token = getToken();
  if (!token) {
    showLogin();
    return null;
  }
  try {
    const user = await api('/auth/me');
    showApp(user);
    if (typeof window.refreshCurrentPage === 'function') window.refreshCurrentPage();
    return user;
  } catch {
    showLogin();
    return null;
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  loginError.textContent = '';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!username || !password) {
    loginError.textContent = 'Please enter username and password.';
    return;
  }
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    showApp(data.user);
    document.getElementById('password').value = '';
    if (window.onAuthReady) window.onAuthReady(data.user);
    window.location.hash = 'pos';
    return false;
  } catch (err) {
    if (err.status === undefined || err.message === 'Failed to fetch') {
      loginError.textContent = 'Cannot connect to server. Is the backend running? (e.g. npm start in backend folder)';
    } else {
      loginError.textContent = err.error || 'Login failed.';
    }
  }
  return false;
});

if (logoutBtn) logoutBtn.addEventListener('click', () => { window.currentUser = null; showLogin(); if (window.onLogout) window.onLogout(); });

checkAuth();

(function () {
  var passwordInput = document.getElementById('password');
  var toggleBtn = document.getElementById('toggle-password');
  if (!passwordInput || !toggleBtn) return;
  toggleBtn.addEventListener('click', function () {
    var isVisible = passwordInput.type === 'text';
    passwordInput.type = isVisible ? 'password' : 'text';
    toggleBtn.setAttribute('aria-pressed', !isVisible);
    toggleBtn.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    toggleBtn.title = isVisible ? 'Show password' : 'Hide password';
  });
})();
