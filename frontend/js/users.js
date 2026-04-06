(function () {
  const tbody = document.getElementById('users-tbody');
  const btnAdd = document.getElementById('btn-add-user');
  const accessMsg = document.getElementById('users-access-msg');
  const adminContent = document.getElementById('users-admin-content');
  const tabBar = document.querySelector('.user-role-tabs');

  const modal = document.getElementById('user-modal');
  const modalTitle = document.getElementById('user-modal-title');
  const modalClose = document.getElementById('user-modal-close');
  const cancelBtn = document.getElementById('user-cancel-btn');
  const form = document.getElementById('user-form');
  const formError = document.getElementById('user-form-error');
  const passwordHint = document.getElementById('user-password-hint');
  const elId = document.getElementById('user_id');
  const elUsername = document.getElementById('user_username');
  const elPassword = document.getElementById('user_password');
  const elFullName = document.getElementById('user_full_name');
  const elRole = document.getElementById('user_role');

  let allUsers = [];
  let roleFilter = 'all';

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function roleLabel(role) {
    const m = { admin: 'Administrator', manager: 'Manager', cashier: 'Cashier' };
    return m[role] || role;
  }

  function isAdmin() {
    return window.currentUser && window.currentUser.role === 'admin';
  }

  function setTabsActive(filter) {
    if (!tabBar) return;
    tabBar.querySelectorAll('.role-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.roleFilter === filter);
    });
  }

  function renderTable() {
    if (!tbody) return;
    const filtered =
      roleFilter === 'all' ? allUsers : allUsers.filter((u) => u.role === roleFilter);
    tbody.innerHTML =
      filtered.length === 0
        ? '<tr><td colspan="5">No users in this view</td></tr>'
        : filtered
            .map(
              (u) => `
        <tr data-id="${u.user_id}">
          <td>${u.user_id}</td>
          <td>${esc(u.username)}</td>
          <td>${esc(u.full_name || '—')}</td>
          <td>${esc(roleLabel(u.role))}</td>
          <td class="table-actions">
            <button type="button" class="btn btn-ghost btn-sm user-edit" data-id="${u.user_id}">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm user-delete" data-id="${u.user_id}">Delete</button>
          </td>
        </tr>`
            )
            .join('');
  }

  function openModal(mode, user) {
    formError.textContent = '';
    elPassword.value = '';
    elPassword.required = mode === 'add';
    if (passwordHint) {
      passwordHint.hidden = false;
      passwordHint.textContent =
        mode === 'add'
          ? 'Required for new users — at least 6 characters.'
          : 'Leave blank to keep the current password. Otherwise use at least 6 characters.';
    }
    if (mode === 'add') {
      modalTitle.textContent = 'Add User';
      elId.value = '';
      elUsername.value = '';
      elFullName.value = '';
      elRole.value = 'cashier';
      elUsername.disabled = false;
    } else {
      modalTitle.textContent = 'Edit User';
      elId.value = user.user_id;
      elUsername.value = user.username || '';
      elFullName.value = user.full_name || '';
      elRole.value = user.role;
      elUsername.disabled = false;
    }
    modal.hidden = false;
    elUsername.focus();
  }

  function closeModal() {
    if (modal) modal.hidden = true;
  }

  async function loadUsers() {
    if (!tbody) return;
    try {
      allUsers = await api('/users');
      renderTable();
    } catch (e) {
      if (e.status === 403) {
        formError.textContent = '';
        accessMsg.hidden = false;
        adminContent.hidden = true;
        if (btnAdd) btnAdd.hidden = true;
        tbody.innerHTML = '<tr><td colspan="5">—</td></tr>';
        return;
      }
      tbody.innerHTML = `<tr><td colspan="5">${esc(e.error || 'Failed to load users')}</td></tr>`;
    }
  }

  function setupUsersPage() {
    if (!accessMsg || !adminContent) return;
    if (!isAdmin()) {
      accessMsg.hidden = false;
      adminContent.hidden = true;
      if (btnAdd) btnAdd.hidden = true;
      if (tbody) tbody.innerHTML = '';
      return;
    }
    accessMsg.hidden = true;
    adminContent.hidden = false;
    if (btnAdd) btnAdd.hidden = false;
    loadUsers();
  }

  if (tabBar) {
    tabBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.role-tab');
      if (!btn) return;
      roleFilter = btn.dataset.roleFilter || 'all';
      setTabsActive(roleFilter);
      renderTable();
    });
  }

  if (btnAdd) {
    btnAdd.addEventListener('click', () => openModal('add'));
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.user-edit');
      const delBtn = e.target.closest('.user-delete');
      if (editBtn) {
        const id = parseInt(editBtn.dataset.id, 10);
        const u = allUsers.find((x) => x.user_id === id);
        if (u) openModal('edit', u);
        return;
      }
      if (delBtn) {
        const id = parseInt(delBtn.dataset.id, 10);
        if (!confirm('Delete this user?')) return;
        try {
          await api(`/users/${id}`, { method: 'DELETE' });
          await loadUsers();
        } catch (err) {
          alert(err.error || 'Delete failed.');
        }
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError.textContent = '';
      const id = elId.value.trim();
      const username = elUsername.value.trim();
      const password = elPassword.value;
      const full_name = elFullName.value.trim() || null;
      const role = elRole.value;

      if (!username) {
        formError.textContent = 'Username is required.';
        return;
      }
      if (!id && (!password || password.length < 6)) {
        formError.textContent = 'Password must be at least 6 characters for new users.';
        return;
      }
      if (id && password && password.length < 6) {
        formError.textContent = 'Password must be at least 6 characters.';
        return;
      }

      try {
        if (!id) {
          await api('/users', {
            method: 'POST',
            body: JSON.stringify({ username, password, role, full_name }),
          });
        } else {
          const body = { username, role, full_name };
          if (password) body.password = password;
          await api(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          });
        }
        closeModal();
        await loadUsers();
      } catch (err) {
        if (err.errors && Array.isArray(err.errors)) {
          formError.textContent = err.errors.map((x) => x.msg || x).join(' ');
        } else {
          formError.textContent = err.error || 'Save failed.';
        }
      }
    });
  }

  window.registerPageLoader('users', setupUsersPage);
})();
