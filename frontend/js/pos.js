let cart = [];
const barcodeInput = document.getElementById('barcode-input');
const productList = document.getElementById('product-list');
const cartItems = document.getElementById('cart-items');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartTax = document.getElementById('cart-tax');
const cartTotal = document.getElementById('cart-total');
const cartDiscount = document.getElementById('cart-discount');
const cartTaxRate = document.getElementById('cart-tax-rate');
const paymentMethod = document.getElementById('payment-method');
const cashSection = document.getElementById('cash-section');
const cashReceived = document.getElementById('cash-received');
const cashChange = document.getElementById('cash-change');
const btnCheckout = document.getElementById('btn-checkout');
const receiptModal = document.getElementById('receipt-modal');
const receiptContent = document.getElementById('receipt-content');
const receiptClose = document.getElementById('receipt-close');
const receiptPrint = document.getElementById('receipt-print');

let searchDebounce;
barcodeInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadProductSearch(barcodeInput.value.trim()), 250);
});
barcodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = barcodeInput.value.trim();
    if (v) lookupBarcode(v);
  }
});

function formatMoney(n) {
  return Number(n).toFixed(2);
}

function renderCart() {
  const discount = parseFloat(cartDiscount.value) || 0;
  const taxRate = parseFloat(cartTaxRate.value) || 0;
  let subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.max(0, taxable * (taxRate / 100));
  const total = taxable + taxAmount;

  cartItems.innerHTML = cart.length === 0
    ? '<p class="text-muted">Cart is empty</p>'
    : cart.map((item, idx) => `
        <div class="cart-item" data-idx="${idx}">
          <div class="name">
            <div class="cart-name">${item.product_name}</div>
            <div class="cart-qty">
              <button type="button" class="qty-btn qty-minus" aria-label="Decrease quantity">−</button>
              <input type="number" class="qty-input" min="1" step="1" value="${item.quantity}" inputmode="numeric" aria-label="Quantity" />
              <button type="button" class="qty-btn qty-plus" aria-label="Increase quantity">+</button>
              <span class="qty-stock">In stock: ${item.stock ?? '—'}</span>
            </div>
          </div>
          <span class="qty-price">${formatMoney(item.price * item.quantity)}</span>
          <button type="button" class="cart-remove" aria-label="Remove">×</button>
        </div>
      `).join('');

  cartSubtotal.textContent = formatMoney(subtotal);
  if (cartTax) cartTax.textContent = formatMoney(taxAmount);
  cartTotal.textContent = formatMoney(total);

  // Cash change preview
  if (paymentMethod && paymentMethod.value === 'cash' && cashReceived && cashChange) {
    const received = parseFloat(cashReceived.value) || 0;
    cashChange.textContent = formatMoney(Math.max(0, received - total));
  }

  cartItems.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.closest('.cart-item').dataset.idx, 10);
      cart.splice(idx, 1);
      renderCart();
    });
  });

  cartItems.querySelectorAll('.cart-item').forEach(row => {
    const idx = parseInt(row.dataset.idx, 10);
    const minus = row.querySelector('.qty-minus');
    const plus = row.querySelector('.qty-plus');
    const input = row.querySelector('.qty-input');
    const item = cart[idx];

    const clampQty = (q) => {
      let qty = Math.max(1, parseInt(q, 10) || 1);
      if (typeof item.stock === 'number') qty = Math.min(qty, item.stock);
      return qty;
    };

    if (minus) minus.addEventListener('click', () => {
      item.quantity = clampQty(item.quantity - 1);
      renderCart();
    });
    if (plus) plus.addEventListener('click', () => {
      item.quantity = clampQty(item.quantity + 1);
      renderCart();
    });
    if (input) {
      input.addEventListener('change', () => {
        item.quantity = clampQty(input.value);
        renderCart();
      });
    }
  });
}

cartDiscount.addEventListener('input', renderCart);
cartTaxRate.addEventListener('input', renderCart);
if (cashReceived) cashReceived.addEventListener('input', renderCart);

function updatePaymentUI() {
  if (!paymentMethod || !cashSection) return;
  const isCash = paymentMethod.value === 'cash';
  cashSection.hidden = !isCash;
  if (isCash && cashReceived) {
    if (!cashReceived.value || Number(cashReceived.value) === 0) {
      cashReceived.value = cartTotal.textContent || '0';
    }
  }
  renderCart();
}
if (paymentMethod) paymentMethod.addEventListener('change', updatePaymentUI);

async function loadProductSearch(q) {
  if (!q) {
    productList.innerHTML = '<p class="text-muted">Type or scan to search products</p>';
    return;
  }
  try {
    const list = await api('/products?search=' + encodeURIComponent(q));
    productList.innerHTML = list.length === 0
      ? '<p class="text-muted">No products found</p>'
      : list.map(p => {
        const q = parseInt(p.quantity, 10) || 0;
        const stockClass = q <= 0 ? 'stock-out' : (q < 10 ? 'stock-low' : 'stock-ok');
        const stockText = q <= 0 ? 'Out of stock' : `${q} available`;
        return `
          <div class="product-card ${q <= 0 ? 'product-unavailable' : ''}" data-id="${p.product_id}" data-name="${p.product_name}" data-price="${p.price}" data-qty="${p.quantity}">
            <div class="name">${p.product_name}</div>
            <div class="price">${formatMoney(p.price)}</div>
            <div class="qty stock-line ${stockClass}">${stockText}</div>
          </div>`;
      }).join('');

    productList.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id, 10);
        const name = card.dataset.name;
        const price = parseFloat(card.dataset.price);
        const stock = parseInt(card.dataset.qty, 10);
        if (stock < 1) return;
        const existing = cart.find(i => i.product_id === id);
        if (existing) {
          existing.stock = stock;
          existing.quantity = Math.min(existing.quantity + 1, stock);
        } else {
          cart.push({ product_id: id, product_name: name, price, quantity: 1, stock });
        }
        renderCart();
      });
    });
  } catch (e) {
    productList.innerHTML = '<p class="text-muted">Error loading products</p>';
  }
}

async function lookupBarcode(barcode) {
  try {
    const p = await api('/products/barcode/' + encodeURIComponent(barcode));
    if (p.quantity < 1) return;
    const existing = cart.find(i => i.product_id === p.product_id);
    if (existing) {
      existing.stock = parseInt(p.quantity, 10);
      existing.quantity = Math.min(existing.quantity + 1, existing.stock);
    } else {
      cart.push({
        product_id: p.product_id,
        product_name: p.product_name,
        price: parseFloat(p.price),
        quantity: 1,
        stock: parseInt(p.quantity, 10),
      });
    }
    renderCart();
    barcodeInput.value = '';
    barcodeInput.focus();
  } catch {
    barcodeInput.select();
  }
}

btnCheckout.addEventListener('click', async () => {
  if (cart.length === 0) return;
  const discount = parseFloat(cartDiscount.value) || 0;
  const taxRate = parseFloat(cartTaxRate.value) || 0;
  const items = cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, price: i.price }));
  const total = parseFloat(cartTotal.textContent) || 0;

  const processSale = async (reference = null) => {
    try {
      let payments = undefined;
      let cash_received = undefined;
      if (paymentMethod.value === 'cash') {
        cash_received = parseFloat(cashReceived.value) || 0;
        if (cash_received < total) {
          alert('Cash received is less than the total amount.');
          return;
        }
        payments = [{ method: 'cash', amount: total, cash_received }];
      } else if (paymentMethod.value === 'mobile_money' && reference) {
        payments = [{ method: 'mobile_money', amount: total, reference }];
      }
      const result = await api('/sales', {
        method: 'POST',
        body: JSON.stringify({
          items,
          discount_amount: discount,
          tax_rate: taxRate,
          payment_method: paymentMethod.value,
          payments,
        }),
      });
      const sale = await api('/sales/' + result.sale_id);
      receiptContent.textContent = formatReceipt(sale);
      receiptModal.hidden = false;
      cart = [];
      cartDiscount.value = 0;
      cartTaxRate.value = 0;
      if (cashReceived) cashReceived.value = 0;
      renderCart();
      loadProductSearch(barcodeInput.value.trim());
      if (typeof window.refreshPosCharts === 'function') window.refreshPosCharts();
    } catch (err) {
      alert(err.error || 'Checkout failed.');
    }
  };

  if (paymentMethod.value === 'mobile_money') {
    try {
      const config = await api('/config');
      if (!config.paystackPublicKey) {
        alert('Paystack Public Key is not configured. Please check backend environment.');
        return;
      }
      const handler = PaystackPop.setup({
        key: config.paystackPublicKey,
        email: 'customer_possystem@gmail.com', // Optionally replace with actual customer email if available
        amount: total * 100, // Amount in lowest denomination
        currency: 'GHS',
        callback: function (response) {
          processSale(response.reference);
        },
        onClose: function () {
          alert('Transaction cancelled.');
        }
      });
      handler.openIframe();
    } catch (err) {
      alert('Failed to initialize payment gateway.');
      console.error(err);
    }
  } else {
    processSale();
  }
});

function formatReceipt(sale) {
  const lines = [
    '--------------------------------',
    '         POS RECEIPT',
    '--------------------------------',
    'Sale #' + sale.sale_id,
    'Date: ' + new Date(sale.sale_date).toLocaleString(),
    'Cashier: ' + (sale.full_name || sale.username),
    '--------------------------------',
  ];
  sale.items.forEach(i => {
    lines.push(`${i.product_name} x${i.quantity} @ ${formatMoney(i.price)} = ${formatMoney(i.subtotal)}`);
  });
  lines.push('--------------------------------');
  if (sale.discount_amount > 0) lines.push('Discount: -' + formatMoney(sale.discount_amount));
  if (sale.tax_amount > 0) lines.push('Tax: ' + formatMoney(sale.tax_amount));
  lines.push('TOTAL: ' + formatMoney(sale.total_amount));
  lines.push('Payment: ' + sale.payment_method);
  if (sale.payments && sale.payments.length) {
    const cashPay = sale.payments.find(p => p.method === 'cash');
    if (cashPay) {
      // Backend stores change_given. We can derive cash received as total + change.
      const change = cashPay.change_given != null ? Number(cashPay.change_given) : null;
      if (change != null && !Number.isNaN(change)) {
        const received = Number(sale.total_amount) + change;
        lines.push('Cash received: ' + formatMoney(received));
        lines.push('Change: ' + formatMoney(change));
      }
    }
  }
  lines.push('--------------------------------');
  return lines.join('\n');
}

receiptClose.addEventListener('click', () => { receiptModal.hidden = true; });

function printReceiptText(text) {
  const w = window.open('', 'pos-receipt-print', 'width=420,height=720');
  if (!w) {
    alert('Popup blocked. Allow popups to print receipts.');
    return;
  }
  const escaped = (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  w.document.open();
  w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt</title>
  <style>
    body { margin: 0; padding: 16px; font-family: Consolas, monospace; color: #111; background: #fff; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.35; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <pre>${escaped}</pre>
  <script>
    window.onload = function () { window.print(); setTimeout(function(){ window.close(); }, 200); };
  </script>
</body>
</html>`);
  w.document.close();
}

if (receiptPrint) receiptPrint.addEventListener('click', () => {
  printReceiptText(receiptContent ? receiptContent.textContent : '');
});

if (window.registerPageLoader) {
  window.registerPageLoader('pos', () => {
    loadProductSearch(barcodeInput.value.trim());
    if (typeof window.refreshPosCharts === 'function') window.refreshPosCharts();
  });
}

updatePaymentUI();
