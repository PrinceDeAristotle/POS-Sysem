const lowStockList = document.getElementById('low-stock-list');
const invForm = document.getElementById('inventory-adjust-form');
const invProduct = document.getElementById('inv-product');
const invDelta = document.getElementById('inv-delta');
const invReason = document.getElementById('inv-reason');
const invError = document.getElementById('inv-error');

function canManageInventory() {
  const role = (window.currentUser && window.currentUser.role) || '';
  return role === 'admin' || role === 'manager';
}

async function loadLowStock() {
  try {
    const list = await api('/inventory/low-stock');
    lowStockList.innerHTML = list.length === 0
      ? '<p class="text-muted">No low stock items</p>'
      : list.map(p => `
          <div class="card-item">
            <span>${p.product_name} (${p.barcode || p.product_id})</span>
            <strong style="color: var(--color-gold);">Qty: ${p.quantity}</strong>
          </div>
        `).join('');
  } catch (e) {
    lowStockList.innerHTML = '<p class="text-muted">Error loading inventory</p>';
  }
}

async function loadProductsForAdjust() {
  if (!invProduct) return;
  try {
    const list = await api('/products');
    if (list.length === 0) {
      invProduct.innerHTML = '<option value="" selected>No products found</option>';
      invProduct.disabled = true;
      return;
    }
    invProduct.disabled = false;
    invProduct.innerHTML =
      '<option value="" selected disabled>Select a product…</option>' +
      list.map(p => `<option value="${p.product_id}">${p.product_name} (Stock: ${p.quantity})</option>`).join('');
  } catch {
    invProduct.innerHTML = '<option value="" selected>Error loading products</option>';
    invProduct.disabled = true;
  }
}

async function loadInventoryPage() {
  await loadLowStock();
  await loadProductsForAdjust();

  if (invForm) {
    invForm.style.display = canManageInventory() ? 'block' : 'none';
  }
}

if (invForm) invForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  invError.textContent = '';
  if (!canManageInventory()) {
    invError.textContent = 'Only Admin/Manager can adjust stock.';
    return;
  }
  const product_id = parseInt(invProduct.value, 10);
  const quantity_delta = parseInt(invDelta.value, 10);
  if (!product_id || Number.isNaN(quantity_delta)) {
    invError.textContent = 'Select a product and enter quantity change.';
    return;
  }
  try {
    await api('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({
        product_id,
        quantity_delta,
        reason: invReason.value.trim() || null,
      }),
    });
    invDelta.value = '1';
    invReason.value = '';
    await loadInventoryPage();
  } catch (err) {
    invError.textContent = err.error || 'Adjustment failed.';
  }
});

if (window.registerPageLoader) window.registerPageLoader('inventory', loadInventoryPage);
