const customersTbody = document.getElementById('customers-tbody');
const btnAddCustomer = document.getElementById('btn-add-customer');

const customerModal = document.getElementById('customer-modal');
const customerModalTitle = document.getElementById('customer-modal-title');
const customerModalClose = document.getElementById('customer-modal-close');
const customerCancelBtn = document.getElementById('customer-cancel-btn');
const customerForm = document.getElementById('customer-form');
const customerFormError = document.getElementById('customer-form-error');

const cId = document.getElementById('customer_id');
const cName = document.getElementById('customer_name');
const cPhone = document.getElementById('customer_phone');
const cEmail = document.getElementById('customer_email');
const cLoyalty = document.getElementById('customer_loyalty');
const cAddress = document.getElementById('customer_address');

function openCustomerModal(mode, customer) {
  customerFormError.textContent = '';
  if (mode === 'add') {
    customerModalTitle.textContent = 'Add Customer';
    cId.value = '';
    cName.value = '';
    cPhone.value = '';
    cEmail.value = '';
    cLoyalty.value = '0';
    cAddress.value = '';
  } else {
    customerModalTitle.textContent = 'Edit Customer';
    cId.value = customer.customer_id;
    cName.value = customer.name || '';
    cPhone.value = customer.phone || '';
    cEmail.value = customer.email || '';
    cLoyalty.value = String(customer.loyalty_points || 0);
    cAddress.value = customer.address || '';
  }
  customerModal.hidden = false;
  cName.focus();
}

function closeCustomerModal() {
  if (customerModal) customerModal.hidden = true;
}

async function loadCustomers() {
  try {
    const list = await api('/customers');
    customersTbody.innerHTML = list.length === 0
      ? '<tr><td colspan="5">No customers</td></tr>'
      : list.map(c => `
          <tr>
            <td>${c.customer_id}</td>
            <td>${c.name}</td>
            <td>${c.phone || '—'}</td>
            <td>${c.email || '—'}</td>
            <td>${c.loyalty_points || 0}</td>
          </tr>
        `).join('');

    // click row to edit
    customersTbody.querySelectorAll('tr').forEach((tr, idx) => {
      const cust = list[idx];
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', async () => {
        const full = await api('/customers/' + cust.customer_id);
        openCustomerModal('edit', full);
      });
    });
  } catch (e) {
    customersTbody.innerHTML = '<tr><td colspan="5">Error loading customers</td></tr>';
  }
}

if (btnAddCustomer) btnAddCustomer.addEventListener('click', () => openCustomerModal('add'));

if (customerModalClose) customerModalClose.addEventListener('click', closeCustomerModal);
if (customerCancelBtn) customerCancelBtn.addEventListener('click', closeCustomerModal);
if (customerModal) {
  customerModal.addEventListener('click', (e) => {
    if (e.target === customerModal) closeCustomerModal();
  });
}

if (customerForm) customerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  customerFormError.textContent = '';

  const payload = {
    name: cName.value.trim(),
    phone: cPhone.value.trim() || null,
    email: cEmail.value.trim() || null,
    address: cAddress.value.trim() || null,
    loyalty_points: parseInt(cLoyalty.value, 10) || 0,
  };

  if (!payload.name) {
    customerFormError.textContent = 'Name is required.';
    return;
  }

  const id = cId.value;
  try {
    if (id) {
      await api('/customers/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      // POST endpoint ignores loyalty_points, so only send allowed fields
      await api('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          address: payload.address,
        }),
      });
    }
    closeCustomerModal();
    await loadCustomers();
  } catch (err) {
    customerFormError.textContent = err.error || 'Save failed.';
  }
});

if (window.registerPageLoader) window.registerPageLoader('customers', loadCustomers);
