const reportDailySales = document.getElementById('report-daily-sales');
const reportDailyRevenue = document.getElementById('report-daily-revenue');
const reportProductPerf = document.getElementById('report-product-perf');

const canvasRevenue = document.getElementById('chart-revenue-trend');
const canvasProducts = document.getElementById('chart-product-performance');

let chartRevenue = null;
let chartProducts = null;

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
  gold: 'rgba(245, 197, 66, 0.9)',
  goldFill: 'rgba(245, 197, 66, 0.2)',
  blue: 'rgba(58, 190, 255, 0.95)',
  blueFill: 'rgba(58, 190, 255, 0.18)',
  grid: 'rgba(245, 245, 245, 0.08)',
  text: '#EAEAEA',
  muted: 'rgba(245, 245, 245, 0.65)',
};

const chartColorsLight = {
  gold: 'rgba(180, 83, 9, 0.95)',
  goldFill: 'rgba(245, 158, 11, 0.15)',
  blue: 'rgba(2, 132, 199, 0.95)',
  blueFill: 'rgba(14, 165, 233, 0.12)',
  grid: 'rgba(15, 23, 42, 0.08)',
  text: '#0f172a',
  muted: '#64748b',
};

function getChartColors() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? chartColorsLight : chartColorsDark;
}

function buildChartDefaults() {
  if (typeof Chart === 'undefined') return;
  const c = getChartColors();
  Chart.defaults.color = c.muted;
  Chart.defaults.borderColor = c.grid;
}

async function loadReports() {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const daily = await api('/reports/daily?date=' + today);
    if (reportDailySales) reportDailySales.textContent = 'Sales: ' + (daily.total_sales || 0);
    if (reportDailyRevenue) reportDailyRevenue.textContent = 'Revenue: ' + formatMoney(daily.total_revenue || 0);
  } catch {
    if (reportDailySales) reportDailySales.textContent = '—';
    if (reportDailyRevenue) reportDailyRevenue.textContent = '—';
  }

  let perf = [];
  try {
    perf = await api('/reports/product-performance?from=' + today + '&to=' + today);
    if (reportProductPerf) {
      reportProductPerf.innerHTML = perf.length === 0
        ? '<p class="text-muted">No sales today</p>'
        : perf.slice(0, 10).map(p => `
            <div class="item">${p.product_name}: ${p.units_sold} sold, ${formatMoney(p.revenue)}</div>
          `).join('');
    }
  } catch {
    if (reportProductPerf) reportProductPerf.innerHTML = '<p class="text-muted">Error loading report</p>';
  }

  if (typeof Chart === 'undefined') return;
  buildChartDefaults();

  /* ---- Revenue trend: last 7 days ---- */
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const from7 = start.toISOString().slice(0, 10);
  const to7 = end.toISOString().slice(0, 10);

  try {
    const weekly = await api('/reports/weekly?from=' + from7 + '&to=' + to7);
    const revenueByDate = {};
    weekly.forEach((row) => {
      const key = normalizeDateKey(row.date);
      revenueByDate[key] = parseFloat(row.revenue) || 0;
    });

    const trendLabels = [];
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trendLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      trendData.push(revenueByDate[key] || 0);
    }

    chartRevenue = destroyChart(chartRevenue);
    if (canvasRevenue) {
      const cc = getChartColors();
      chartRevenue = new Chart(canvasRevenue, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [{
            label: 'Revenue',
            data: trendData,
            borderColor: cc.blue,
            backgroundColor: cc.blueFill,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: cc.blue,
            pointBorderColor: cc.blue,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ' Revenue: ' + formatMoney(ctx.parsed.y),
              },
            },
          },
          scales: {
            x: {
              ticks: { color: cc.text, maxRotation: 45 },
              grid: { color: cc.grid },
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: cc.muted,
                callback: (v) => (Number.isInteger(v) ? v : ''),
              },
              grid: { color: cc.grid },
            },
          },
        },
      });
    }
  } catch {
    chartRevenue = destroyChart(chartRevenue);
  }

  /* ---- Top products today (horizontal bar by revenue) ---- */
  try {
    const top = perf.slice(0, 8);
    const labels = top.map((p) => (p.product_name.length > 22 ? p.product_name.slice(0, 20) + '…' : p.product_name));
    const data = top.map((p) => parseFloat(p.revenue) || 0);

    chartProducts = destroyChart(chartProducts);
    if (canvasProducts) {
      const wrap = canvasProducts.parentElement;
      let emptyMsg = wrap && wrap.querySelector('.chart-empty-msg');
      if (top.length === 0) {
        canvasProducts.style.display = 'none';
        if (wrap) {
          if (!emptyMsg) {
            emptyMsg = document.createElement('p');
            emptyMsg.className = 'text-muted chart-empty-msg';
            wrap.appendChild(emptyMsg);
          }
          emptyMsg.textContent = 'No sales today — chart will show after you complete sales.';
          emptyMsg.style.display = 'block';
        }
      } else {
        canvasProducts.style.display = 'block';
        if (emptyMsg) emptyMsg.style.display = 'none';
        const cc = getChartColors();
        const barRgb = document.documentElement.getAttribute('data-theme') === 'light' ? '2, 132, 199' : '58, 190, 255';
        chartProducts = new Chart(canvasProducts, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Revenue',
              data,
              backgroundColor: top.map(
                (_, i) => `rgba(${barRgb}, ${0.28 + (i / Math.max(top.length, 1)) * 0.42})`
              ),
              borderColor: cc.blue,
              borderWidth: 1,
              borderRadius: 6,
            }],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ' ' + formatMoney(ctx.parsed.x),
                },
              },
            },
            scales: {
              x: {
                beginAtZero: true,
                ticks: { color: cc.muted },
                grid: { color: cc.grid },
              },
              y: {
                ticks: { color: cc.text, font: { size: 11 } },
                grid: { display: false },
              },
            },
          },
        });
      }
    }
  } catch {
    chartProducts = destroyChart(chartProducts);
  }
}

if (window.registerPageLoader) window.registerPageLoader('reports', loadReports);

window.addEventListener('posthemechange', () => {
  if (typeof window.getPageFromHash === 'function' && window.getPageFromHash() === 'reports') {
    loadReports();
  }
});
