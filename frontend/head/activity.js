let currentUser;
let activities = [];
let currentFilter = 'all';

const el = id => document.getElementById(id);

async function init() {
  currentUser = await requireRole(['head']);
  if (!currentUser) return;

  el('userName').textContent = currentUser.name;
  el('userDept').textContent = currentUser.department_name || '';

  bindEvents();
  await loadActivity();
}

function bindEvents() {
  el('refreshBtn').onclick = loadActivity;

  el('searchInput').addEventListener('input', renderTimeline);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');
      currentFilter = btn.dataset.filter;

      renderTimeline();
    };
  });
}

async function loadActivity() {
  // Fetch department tickets first
  const ticketsRes = await apiFetch('/tickets?scope=department');
  const tickets = ticketsRes.tickets || [];

  // Fetch logs + responses per ticket
  const all = [];

  await Promise.all(tickets.map(async t => {
    try {
      const [logsRes, respRes] = await Promise.all([
        apiFetch(`/logs/ticket/${t.id}`),
        apiFetch(`/tickets/${t.id}/responses`)
      ]);

      (logsRes.logs || []).forEach(l => {
        all.push({
          type: 'log',
          ticket_id: t.id,
          ticket_code: t.work_order_id,
          title: t.title,
          action: l.action,
          text: l.details,
          user: l.user_name,
          created_at: l.created_at
        });
      });

      (respRes.responses || []).forEach(r => {
        all.push({
          type: 'response',
          ticket_id: t.id,
          ticket_code: t.work_order_id,
          title: t.title,
          action: r.internal ? 'Internal Note' : 'Response',
          text: r.message,
          user: r.author_name,
          created_at: r.created_at
        });
      });

    } catch (err) {
      console.error('Activity fetch failed for ticket', t.id);
    }
  }));

  activities = all.sort((a,b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );

  renderTimeline();
}

function applyFilter(items) {
  switch (currentFilter) {
    case 'status':
      return items.filter(i =>
        i.action?.toLowerCase().includes('status')
      );
    case 'assign':
      return items.filter(i =>
        i.action?.toLowerCase().includes('assign')
      );
    case 'response':
      return items.filter(i => i.type === 'response');
    default:
      return items;
  }
}

function applySearch(items) {
  const q = el('searchInput').value.toLowerCase();
  if (!q) return items;

  return items.filter(i =>
    i.title.toLowerCase().includes(q) ||
    (i.text || '').toLowerCase().includes(q) ||
    (i.user || '').toLowerCase().includes(q) ||
    i.ticket_code.toLowerCase().includes(q)
  );
}

function groupByDate(items) {
  const groups = {};

  items.forEach(item => {
    const date = new Date(item.created_at).toDateString();

    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  });

  return groups;
}

function renderTimeline() {
  let items = [...activities];
  items = applyFilter(items);
  items = applySearch(items);

  if (!items.length) {
    el('timelineContainer').innerHTML =
      `<div class="empty-state">No activity found</div>`;
    return;
  }

  const grouped = groupByDate(items);

  el('timelineContainer').innerHTML = Object.keys(grouped).map(date => `
    <div class="card">

      <h3 class="section-title">${date}</h3>

      <div class="responses-list">

        ${grouped[date].map(item => `
          <div class="response-card">

            <div class="response-head">
              <strong>${item.action}</strong>

              <span class="response-role">
                ${item.user || 'System'}
              </span>

              <span class="response-meta">
                ${new Date(item.created_at).toLocaleTimeString()}
              </span>
            </div>

            <p>${item.text || ''}</p>

            <div class="response-meta">
              Ticket: ${item.ticket_code} — ${item.title}
            </div>

          </div>
        `).join('')}

      </div>

    </div>
  `).join('');
}

init();