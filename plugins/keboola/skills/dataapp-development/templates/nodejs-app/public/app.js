async function loadSummary() {
  const res = await fetch('/api/summary');
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

(async () => {
  const summary = await loadSummary();
  if (!summary) return;
  document.getElementById('row-count').textContent =
    Number(summary.row_count).toLocaleString();

  const ctx = document.getElementById('chart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Rows'],
      datasets: [{ label: 'Total', data: [summary.row_count], backgroundColor: '#1F8FFF' }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
})();
