const productsTbody = document.getElementById('products-tbody');
const btnAddProduct = document.getElementById('btn-add-product');
const productsSkeleton = document.getElementById('products-skeleton');
const productsPagination = document.getElementById('products-pagination');
const productsPaginationInfo = document.getElementById('products-pagination-info');
const productsPagePrev = document.getElementById('products-page-prev');
const productsPageNext = document.getElementById('products-page-next');
const productModalSubtitle = document.getElementById('product-modal-subtitle');

const PAGE_SIZE = 10;

let productsCache = [];
let sortKey = 'product_name';
let sortDir = 'asc';
let pageIndex = 0;
let filterQuery = '';

function getWorkingList() {
  const q = filterQuery.trim().toLowerCase();
  if (!q) return productsCache;
  return productsCache.filter((p) => {
    const name = (p.product_name || '').toLowerCase();
    const bc = (p.barcode || '').toLowerCase();
    const cat = (p.category_name || '').toLowerCase();
    return (
      name.includes(q) ||
      bc.includes(q) ||
      cat.includes(q) ||
      String(p.product_id).includes(q)
    );
  });
}

function formatMoney(n) {
  return Number(n).toFixed(2);
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function stockBadge(qty) {
  const q = parseInt(qty, 10) || 0;
  if (q <= 0) return '<span class="stock-badge stock-badge--out">Out of stock</span>';
  if (q < 10)
    return `<span class="stock-badge stock-badge--low">${q} <span class="stock-label">low</span></span>`;
  return `<span class="stock-badge stock-badge--ok">${q} <span class="stock-label">in stock</span></span>`;
}

const pencilIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

const productModal = document.getElementById('product-modal');
const productModalTitle = document.getElementById('product-modal-title');
const productModalClose = document.getElementById('product-modal-close');
const productCancelBtn = document.getElementById('product-cancel-btn');
const productDeleteBtn = document.getElementById('product-delete-btn');
const productForm = document.getElementById('product-form');
const productFormError = document.getElementById('product-form-error');

const fId = document.getElementById('product_id');
const fName = document.getElementById('product_name');
const fCategory = document.getElementById('category_id');
const fPrice = document.getElementById('price');
const fQty = document.getElementById('quantity');
const fBarcode = document.getElementById('barcode');
const fSupplier = document.getElementById('supplier');

let cachedCategories = null;

function canManageProducts() {
  const role = (window.currentUser && window.currentUser.role) || '';
  return role === 'admin' || role === 'manager';
}

async function loadCategories() {
  if (cachedCategories) return cachedCategories;
  cachedCategories = await api('/categories');
  return cachedCategories;
}

async function renderCategoryOptions(selectedId) {
  const cats = await loadCategories();
  const current = selectedId ? String(selectedId) : '';
  fCategory.innerHTML =
    `<option value="">—</option>` +
    cats
      .map(
        (c) =>
          `<option value="${c.category_id}" ${String(c.category_id) === current ? 'selected' : ''}>${esc(
            c.name
          )}</option>`
      )
      .join('');
}

function getSortValue(row, key) {
  switch (key) {
    case 'product_id':
      return parseInt(row.product_id, 10) || 0;
    case 'price':
      return parseFloat(row.price) || 0;
    case 'quantity':
      return parseInt(row.quantity, 10) || 0;
    case 'product_name':
      return (row.product_name || '').toLowerCase();
    case 'category_name':
      return (row.category_name || '').toLowerCase();
    case 'barcode':
      return (row.barcode || '').toLowerCase();
    default:
      return row[key];
  }
}

function sortedList() {
  const list = [...getWorkingList()];
  const dir = sortDir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return list;
}

function updateSortHeaders() {
  document.querySelectorAll('.data-table-products .th-sort').forEach((btn) => {
    btn.classList.remove('is-sorted-asc', 'is-sorted-desc');
    if (btn.dataset.sort === sortKey) {
      btn.classList.add(sortDir === 'asc' ? 'is-sorted-asc' : 'is-sorted-desc');
    }
  });
}

function renderPagination(total) {
  if (!productsPagination || !productsPaginationInfo) return;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pageIndex >= pages) pageIndex = Math.max(0, pages - 1);
  if (total <= PAGE_SIZE) {
    productsPagination.hidden = true;
    return;
  }
  productsPagination.hidden = false;
  const start = pageIndex * PAGE_SIZE + 1;
  const end = Math.min((pageIndex + 1) * PAGE_SIZE, total);
  productsPaginationInfo.textContent = `Showing ${start}–${end} of ${total}`;
  if (productsPagePrev) productsPagePrev.disabled = pageIndex <= 0;
  if (productsPageNext) productsPageNext.disabled = pageIndex >= pages - 1;
}

async function updateKpis() {
  const elTotal = document.getElementById('kpi-total-products');
  const elLow = document.getElementById('kpi-low-stock');
  const elRev = document.getElementById('kpi-revenue-today');
  const total = productsCache.length;
  const low = productsCache.filter((p) => {
    const q = parseInt(p.quantity, 10) || 0;
    return q > 0 && q < 10;
  }).length;
  if (elTotal) elTotal.textContent = String(total);
  if (elLow) elLow.textContent = String(low);
  if (elRev) {
    try {
      const d = await api('/reports/daily');
      elRev.textContent = formatMoney(d.total_revenue != null ? d.total_revenue : 0);
    } catch {
      elRev.textContent = '—';
    }
  }
}

function renderProductsTable() {
  if (!productsTbody) return;
  const list = sortedList();
  const total = list.length;
  const canManage = canManageProducts();

  if (btnAddProduct) btnAddProduct.style.display = canManage ? 'inline-flex' : 'none';

  updateSortHeaders();
  renderPagination(total);

  if (total === 0) {
    const filtered = filterQuery.trim().length > 0 && productsCache.length > 0;
    productsTbody.innerHTML = `
      <tr><td colspan="7">
        <div class="products-empty-state">
          <div class="products-empty-state-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <h3>${filtered ? 'No matches' : 'No products yet'}</h3>
          <p>${
            filtered
              ? 'Try another search term or clear the top bar search.'
              : 'Add your first product to start selling. Barcodes and categories help at checkout.'
          }</p>
        </div>
      </td></tr>`;
    return;
  }

  const start = pageIndex * PAGE_SIZE;
  const pageRows = list.slice(start, start + PAGE_SIZE);

  productsTbody.innerHTML = pageRows
    .map(
      (p) => `
      <tr data-id="${p.product_id}">
        <td>${p.product_id}</td>
        <td>${esc(p.product_name)}</td>
        <td>${esc(p.category_name || '—')}</td>
        <td>${formatMoney(p.price)}</td>
        <td>${stockBadge(p.quantity)}</td>
        <td>${esc(p.barcode || '—')}</td>
        <td class="table-actions-premium">
          ${
            canManage
              ? `<button type="button" class="btn-icon-action btn-edit-product" data-id="${p.product_id}" title="Edit product" aria-label="Edit product">${pencilIcon}</button>`
              : ''
          }
        </td>
      </tr>`
    )
    .join('');

  if (canManage) {
    productsTbody.querySelectorAll('.btn-edit-product').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        const product = await api('/products/' + id);
        openProductModal('edit', product);
      });
    });
  }
}

document.querySelector('.data-table-products thead')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.th-sort');
  if (!btn || !btn.dataset.sort) return;
  const key = btn.dataset.sort;
  if (sortKey === key) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDir = 'asc';
  }
  pageIndex = 0;
  renderProductsTable();
});

if (productsPagePrev) {
  productsPagePrev.addEventListener('click', () => {
    if (pageIndex > 0) {
      pageIndex--;
      renderProductsTable();
    }
  });
}
if (productsPageNext) {
  productsPageNext.addEventListener('click', () => {
    const total = sortedList().length;
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pageIndex < pages - 1) {
      pageIndex++;
      renderProductsTable();
    }
  });
}

function openProductModal(mode, product) {
  productFormError.textContent = '';
  const managing = canManageProducts();

  if (!managing) {
    alert('Only Admin or Manager can add/edit/delete products.');
    return;
  }

  if (productModalSubtitle) {
    productModalSubtitle.textContent =
      mode === 'add'
        ? 'Create a catalog item with price and initial stock. Barcode should be unique when set.'
        : 'Update details below. Leave barcode blank if not used. Stock changes here replace the current quantity.';
  }

  if (mode === 'add') {
    productModalTitle.textContent = 'Add Product';
    fId.value = '';
    fName.value = '';
    fPrice.value = '0';
    fQty.value = '0';
    fBarcode.value = '';
    fSupplier.value = '';
    productDeleteBtn.hidden = true;
    renderCategoryOptions('');
  } else {
    productModalTitle.textContent = 'Edit Product';
    fId.value = product.product_id;
    fName.value = product.product_name || '';
    fPrice.value = product.price != null ? String(product.price) : '0';
    fQty.value = product.quantity != null ? String(product.quantity) : '0';
    fBarcode.value = product.barcode || '';
    fSupplier.value = product.supplier || '';
    productDeleteBtn.hidden = false;
    renderCategoryOptions(product.category_id);
  }

  productModal.hidden = false;
  fName.focus();
}

function closeProductModal() {
  if (productModal) productModal.hidden = true;
}

async function loadProducts() {
  if (!productsTbody) return;
  if (productsSkeleton) {
    productsSkeleton.hidden = false;
    productsTbody.innerHTML = '';
  }
  try {
    const list = await api('/products');
    productsCache = list;
    pageIndex = Math.min(pageIndex, Math.max(0, Math.ceil(list.length / PAGE_SIZE) - 1));
    await updateKpis();
    renderProductsTable();
  } catch (e) {
    productsTbody.innerHTML = `<tr><td colspan="7">${esc(e.error || 'Error loading products')}</td></tr>`;
    if (productsPagination) productsPagination.hidden = true;
  } finally {
    if (productsSkeleton) productsSkeleton.hidden = true;
  }
}

if (btnAddProduct)
  btnAddProduct.addEventListener('click', async () => {
    openProductModal('add');
  });

if (productModalClose) productModalClose.addEventListener('click', closeProductModal);
if (productCancelBtn) productCancelBtn.addEventListener('click', closeProductModal);
if (productModal) {
  productModal.addEventListener('click', (e) => {
    if (e.target === productModal) closeProductModal();
  });
}

if (productDeleteBtn) {
  productDeleteBtn.addEventListener('click', async () => {
    const id = fId.value;
    if (!id) return;
    const ok =
      typeof window.appConfirm === 'function'
        ? await window.appConfirm('Delete this product? This cannot be undone if the product has no sales history linked.', {
            title: 'Delete product',
            okText: 'Delete',
            dangerous: true,
          })
        : confirm('Delete this product?');
    if (!ok) return;
    try {
      await api('/products/' + id, { method: 'DELETE' });
      closeProductModal();
      await loadProducts();
    } catch (err) {
      productFormError.textContent = err.error || 'Delete failed.';
    }
  });
}

if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    productFormError.textContent = '';
    const payload = {
      product_name: fName.value.trim(),
      category_id: fCategory.value ? parseInt(fCategory.value, 10) : null,
      price: parseFloat(fPrice.value),
      quantity: parseInt(fQty.value, 10),
      barcode: fBarcode.value.trim() || null,
      supplier: fSupplier.value.trim() || null,
    };
    if (!payload.product_name) {
      productFormError.textContent = 'Product name is required.';
      return;
    }
    if (Number.isNaN(payload.price) || payload.price < 0) {
      productFormError.textContent = 'Price must be 0 or more.';
      return;
    }
    if (Number.isNaN(payload.quantity) || payload.quantity < 0) {
      productFormError.textContent = 'Quantity must be 0 or more.';
      return;
    }

    const id = fId.value;
    if (id) {
      const confirmSave =
        typeof window.appConfirm === 'function'
          ? await window.appConfirm('Save changes to this product?', {
              title: 'Save changes',
              okText: 'Save',
              dangerous: false,
            })
          : true;
      if (!confirmSave) return;
    }

    try {
      if (id) {
        await api('/products/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/products', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeProductModal();
      await loadProducts();
    } catch (err) {
      productFormError.textContent = err.error || 'Save failed.';
    }
  });
}

if (window.registerPageLoader) window.registerPageLoader('products', loadProducts);

(function bindGlobalSearch() {
  const inp = document.getElementById('global-search');
  if (!inp) return;
  let t;
  inp.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      filterQuery = inp.value;
      if (window.getPageFromHash && window.getPageFromHash() === 'products') {
        pageIndex = 0;
        renderProductsTable();
      }
    }, 220);
  });
})();
