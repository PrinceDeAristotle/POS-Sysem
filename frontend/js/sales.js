const salesTbody = document.getElementById('sales-tbody');

function formatMoney(n) {
  return Number(n).toFixed(2);
}

async function loadSales() {
  try {
    const list = await api('/sales');
    salesTbody.innerHTML = list.length === 0
      ? '<tr><td colspan="6">No sales</td></tr>'
      : list.map(s => `
          <tr>
            <td>${s.sale_id}</td>
            <td>${new Date(s.sale_date).toLocaleString()}</td>
            <td>${s.full_name || s.username}</td>
            <td>${formatMoney(s.total_amount)}</td>
            <td>${s.payment_method}</td>
            <td class="actions">
              <button type="button" class="btn btn-secondary btn-receipt" data-id="${s.sale_id}">Receipt</button>
            </td>
          </tr>
        `).join('');

    salesTbody.querySelectorAll('.btn-receipt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sale = await api('/sales/' + btn.dataset.id);
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
          if (cashPay && cashPay.change_given != null) {
            const change = Number(cashPay.change_given);
            if (!Number.isNaN(change)) {
              const received = Number(sale.total_amount) + change;
              lines.push('Cash received: ' + formatMoney(received));
              lines.push('Change: ' + formatMoney(change));
            }
          }
        }
        lines.push('--------------------------------');
        document.getElementById('receipt-content').textContent = lines.join('\n');
        document.getElementById('receipt-modal').hidden = false;
      });
    });
  } catch (e) {
    salesTbody.innerHTML = '<tr><td colspan="6">Error loading sales</td></tr>';
  }
}

if (window.registerPageLoader) window.registerPageLoader('sales', loadSales);
