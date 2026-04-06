/**
 * POS / Cashier — compact sales trend + stock distribution charts.
 * Requires Chart.js (loaded before this file).
 */
(function () {
  const canvasSales = document.getElementById('pos-chart-sales');
  const canvasStock = document.getElementById('pos-chart-stock');

  let chartSales = null;
  let chartStock = null;

  function formatMoney(n) {
    return Number(n).toFixed(2);
  }

  function destroyChart(chart) {
    if (chart && typeof chart.destroy === 'function') chart.destroy();
    return null;
  }

  function normalizeDateKey(v) {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  }

  const chartColorsDark = {
    gold: 'rgba(245, 197, 66, 0.95)',
    goldFill: 'rgba(245, 197, 66, 0.18)',
    blue: 'rgba(58, 190, 255, 0.95)',
    blueFill: 'rgba(58, 190, 255, 0.2)',
    grid: 'rgba(245, 245, 245, 0.08)',
    text: '#EAEAEA',
    muted: 'rgba(245, 245, 245, 0.65)',
    pieOk: 'rgba(34, 197, 94, 0.85)',
    pieLow: 'rgba(251, 146, 60, 0.88)',
    pieOut: 'rgba(248, 113, 113, 0.85)',
  };

  const chartColorsLight = {
    gold: 'rgba(212, 160, 23, 0.95)',
    goldFill: 'rgba(245, 197, 66, 0.2)',
    blue: 'rgba(2, 132, 199, 0.95)',
    blueFill: 'rgba(14, 165, 233, 0.15)',
    grid: 'rgba(15, 23, 42, 0.08)',
    text: '#0f172a',
    muted: '#64748b',
    pieOk: 'rgba(21, 128, 61, 0.88)',
    pieLow: 'rgba(194, 65, 12, 0.88)',
    pieOut: 'rgba(185, 28, 28, 0.85)',
  };

  function getChartColors() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? chartColorsLight : chartColorsDark;
  }

  async function loadPosCharts() {
    if (typeof Chart === 'undefined') return;

    const cc = getChartColors();

    /* ---- 7-day revenue (same source as Reports) ---- */
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const from7 = start.toISOString().slice(0, 10);
    const to7 = end.toISOString().slice(0, 10);

    try {
      const weekly = await api('/reports/weekly?from=' + from7 + '&to=' + to7);
      const revenueByDate = {};
      const countByDate = {};
      weekly.forEach((row) => {
        const key = normalizeDateKey(row.date);
        revenueByDate[key] = parseFloat(row.revenue) || 0;
        countByDate[key] = parseInt(row.sales_count, 10) || 0;
      });

      const trendLabels = [];
      const trendData = [];
      const countData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        trendLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        trendData.push(revenueByDate[key] || 0);
        countData.push(countByDate[key] || 0);
      }

      chartSales = destroyChart(chartSales);
      if (canvasSales) {
        chartSales = new Chart(canvasSales, {
          type: 'line',
          data: {
            labels: trendLabels,
            datasets: [
              {
                label: 'Revenue',
                data: trendData,
                borderColor: cc.gold,
                backgroundColor: cc.goldFill,
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: cc.gold,
                pointBorderColor: cc.gold,
                yAxisID: 'y',
              },
              {
                label: '# Sales',
                data: countData,
                borderColor: cc.blue,
                backgroundColor: cc.blueFill,
                fill: false,
                tension: 0.35,
                pointRadius: 2,
                pointHoverRadius: 4,
                borderDash: [4, 3],
                yAxisID: 'y1',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
              legend: {
                display: true,
                position: 'bottom',
                labels: { boxWidth: 10, font: { size: 9 }, color: cc.muted, padding: 8 },
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    if (ctx.datasetIndex === 0) return ' Revenue: ' + formatMoney(ctx.parsed.y);
                    return ' Sales: ' + ctx.parsed.y;
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: { color: cc.muted, maxRotation: 45, font: { size: 10 } },
                grid: { color: cc.grid },
              },
              y: {
                beginAtZero: true,
                position: 'left',
                ticks: {
                  color: cc.muted,
                  font: { size: 10 },
                  callback: (v) => (Number.isInteger(v) ? v : ''),
                },
                grid: { color: cc.grid },
              },
              y1: {
                beginAtZero: true,
                position: 'right',
                min: 0,
                suggestedMax: Math.max(4, ...countData, 1),
                ticks: {
                  color: cc.muted,
                  font: { size: 9 },
                  stepSize: 1,
                  precision: 0,
                },
                grid: { drawOnChartArea: false },
              },
            },
          },
        });
      }
    } catch {
      chartSales = destroyChart(chartSales);
    }

    /* ---- Stock pie: count products by band (ok / low / out) ---- */
    try {
      const products = await api('/products');
      let ok = 0;
      let low = 0;
      let out = 0;
      products.forEach((p) => {
        const q = parseInt(p.quantity, 10);
        const qty = Number.isFinite(q) ? q : 0;
        if (qty <= 0) out += 1;
        else if (qty < 10) low += 1;
        else ok += 1;
      });

      const labels = ['In stock (10+)', 'Low (1–9)', 'Out of stock'];
      const data = [ok, low, out];
      const colors = [cc.pieOk, cc.pieLow, cc.pieOut];
      const hasData = ok + low + out > 0;

      chartStock = destroyChart(chartStock);
      if (canvasStock) {
        const wrap = canvasStock.parentElement;
        let emptyMsg = wrap && wrap.querySelector('.pos-chart-empty');
        if (!hasData) {
          canvasStock.style.display = 'none';
          if (wrap) {
            if (!emptyMsg) {
              emptyMsg = document.createElement('p');
              emptyMsg.className = 'text-muted pos-chart-empty';
              emptyMsg.style.cssText = 'margin:0;padding:1rem;text-align:center;font-size:0.85rem;';
              wrap.appendChild(emptyMsg);
            }
            emptyMsg.textContent = 'No products in catalog yet.';
            emptyMsg.hidden = false;
          }
        } else {
          canvasStock.style.display = 'block';
          if (emptyMsg) emptyMsg.hidden = true;
          chartStock = new Chart(canvasStock, {
            type: 'pie',
            data: {
              labels,
              datasets: [
                {
                  data,
                  backgroundColor: colors,
                  borderColor: document.documentElement.getAttribute('data-theme') === 'light'
                    ? 'rgba(255,255,255,0.95)'
                    : 'rgba(18,18,20,0.9)',
                  borderWidth: 2,
                  hoverOffset: 8,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    color: cc.muted,
                    boxWidth: 12,
                    font: { size: 10 },
                    padding: 10,
                  },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const n = ctx.parsed;
                      const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                      const pct = total ? ((n / total) * 100).toFixed(0) : 0;
                      return ` ${ctx.label}: ${n} (${pct}%)`;
                    },
                  },
                },
              },
            },
          });
        }
      }
    } catch {
      chartStock = destroyChart(chartStock);
    }
  }

  window.refreshPosCharts = loadPosCharts;

  window.addEventListener('posthemechange', () => {
    if (typeof window.getPageFromHash === 'function' && window.getPageFromHash() === 'pos') {
      loadPosCharts();
    }
  });
})();
