window.formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};

window.formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

window.statusClass = (status) => {
  const map = {
    Open: 'open',
    Assigned: 'progress',
    'In Progress': 'progress',
    Resolved: 'resolved',
    Closed: 'closed'
  };
  return map[status] || 'closed';
};