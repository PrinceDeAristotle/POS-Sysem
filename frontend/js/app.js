const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const pageLoaders = {};

function showPage(pageId) {
  // Role-based access guard: redirect to POS if user lacks permission
  if (window.currentUser && typeof window.canAccessPage === 'function') {
    if (!window.canAccessPage(window.currentUser.role, pageId)) {
      pageId = 'pos';
      window.location.hash = 'pos';
    }
  }
  pages.forEach(p => { p.hidden = p.id !== 'page-' + pageId; });
  navLinks.forEach(l => {
    l.classList.toggle('active', l.dataset.page === pageId);
  });
  if (pageLoaders[pageId]) pageLoaders[pageId]();
}
window.registerPageLoader = (pageId, fn) => { pageLoaders[pageId] = fn; };

function getPageFromHash() {
  const hash = window.location.hash.slice(1) || 'pos';
  return hash;
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    window.location.hash = page;
    showPage(page);
  });
});

window.addEventListener('hashchange', () => showPage(getPageFromHash()));
showPage(getPageFromHash());

window.showPage = showPage;
window.getPageFromHash = getPageFromHash;
window.getPageLoaders = () => pageLoaders;

/** Re-run the loader for the current hash (e.g. after auth/session restore). */
window.refreshCurrentPage = function refreshCurrentPage() {
  const id = getPageFromHash();
  if (pageLoaders[id]) pageLoaders[id]();
};

// Mobile sidebar toggle
const sidebarToggle = document.getElementById('sidebar-toggle');
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
}
// Close sidebar when navigating
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });
});

/** Native dialog confirm — used by products (delete / save). */
(function setupConfirmDialog() {
  const dlg = document.getElementById('app-confirm-dialog');
  const msg = document.getElementById('confirm-dialog-message');
  const titleEl = document.getElementById('confirm-dialog-title');
  const okBtn = document.getElementById('confirm-dialog-ok');
  const cancelBtn = document.getElementById('confirm-dialog-cancel');
  if (!dlg || !msg || !titleEl || !okBtn || !cancelBtn) return;

  window.appConfirm = function appConfirm(message, opts = {}) {
    return new Promise((resolve) => {
      msg.textContent = message;
      titleEl.textContent = opts.title || 'Confirm';
      okBtn.textContent = opts.okText || 'Confirm';
      cancelBtn.textContent = opts.cancelText || 'Cancel';
      const danger = opts.dangerous !== false;
      okBtn.className = danger ? 'btn-danger' : 'btn btn-primary';

      function finish(value) {
        dlg.close();
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        dlg.removeEventListener('cancel', onEsc);
        resolve(value);
      }
      function onOk() {
        finish(true);
      }
      function onCancel() {
        finish(false);
      }
      function onEsc() {
        finish(false);
      }
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      dlg.addEventListener('cancel', onEsc, { once: true });
      dlg.showModal();
    });
  };
})();

/* Notification bell: add WebSocket / polling later; tooltip explains current state */
document.getElementById('topbar-notify-btn')?.setAttribute(
  'title',
  'Notifications — connect low-stock & daily summary alerts here'
);
