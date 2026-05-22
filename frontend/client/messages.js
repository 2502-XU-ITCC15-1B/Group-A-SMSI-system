let currentUser = null;
let messageThread = [];

document.addEventListener('DOMContentLoaded', async () => {
  await ClientPortal.hydrateClientSession();
  await logCurrentRole();

  if (!(await ensureClientInboxAccess())) {
    return;
  }

  ClientPortal.initPage({
    activeNav: 'messages',
    title: 'Inbox',
    subtitle: 'Message your support team directly. Choose admin or your department head.',
    breadcrumbs: ['Client Portal', 'Inbox']
  });

  await populateRecipientOptions();
  bindMessageForm();
  await loadMessages();
});

async function logCurrentRole() {
  let user = getUser();
  const token = getToken();
  if (!user && token) {
    user = await getMe();
  }
  const userRole = String(user?.role || '').trim();
  console.log('Current User Role:', userRole, { user, hasToken: !!token });
  return userRole;
}

async function ensureClientInboxAccess() {
  let user = getUser();
  const token = getToken();

  if (!user && token) {
    user = await getMe();
  }

  const userRole = String(user?.role || '').trim();
  const role = userRole.toLowerCase();

  const allowedExact = ['Admin', 'Head', 'Client', 'Technician'];
  const allowedLower = ['admin', 'head', 'client', 'technician'];

  console.log('Current User Role:', userRole, 'normalized:', role);

  if (!token || !user) {
    console.log('Redirecting because: missing token or user', { user, token });
    window.location.href = '/login.html';
    return false;
  }

  if (allowedExact.includes(userRole) || allowedLower.includes(role)) {
    return true;
  }

  console.log('Redirecting because: role not allowed', { userRole, role });
  window.location.href = '/login.html';
  return false;
}

async function loadMessages() {
  const user = await getMe();
  if (!user) return;

  currentUser = user;
  const messages = await fetchUserMessages(user.id);
  messageThread = Array.isArray(messages) ? messages : [];
  renderMessageThread();
  setMessagesMessage(messageThread.length ? '' : 'No messages yet. Send a message to start your private admin thread.');
}

function renderMessageThread() {
  const container = document.getElementById('clientMessageThread');
  if (!container) return;

  if (!messageThread.length) {
    container.innerHTML = '<li class="message-empty">No conversation found yet. Send a message to start your private admin thread.</li>';
    return;
  }

  container.innerHTML = messageThread.map((message) => {
    const isSent = Number(message.sender_id) === Number(currentUser?.id);
    const author = isSent ? 'You' : (message.sender_name || 'Administrator');
    const timestamp = new Date(message.created_at).toLocaleString();
    const body = ClientPortal.escapeHtml(message.message || '');

    return `
      <li class="message-item ${isSent ? 'sent' : 'received'}">
        <div class="message-meta">
          <span>${author}</span>
          <span>${timestamp}</span>
        </div>
        <div class="message-content">${body}</div>
      </li>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function setMessagesMessage(message, type = '') {
  const node = document.getElementById('messagesMessage');
  if (!node) return;
  node.textContent = message;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}

function bindMessageForm() {
  const form = document.getElementById('clientMessageForm');
  const textarea = document.getElementById('clientMessageText');
  const recipientSelect = document.getElementById('clientMessageRecipient');
  const statusNode = document.getElementById('clientMessageStatus');
  const refreshButton = document.getElementById('refreshThreadBtn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const value = textarea.value.trim();
    const selectedReceiver = recipientSelect.value;
    statusNode.textContent = '';

    if (!selectedReceiver) {
      statusNode.textContent = 'Please select a recipient for this message.';
      return;
    }

    if (!value) {
      statusNode.textContent = 'Please type a message before sending.';
      return;
    }

    form.querySelector('button[type="submit"]').disabled = true;

    const result = await sendMessage({ message: value, receiver_id: Number(selectedReceiver) });

    if (!result?.success) {
      statusNode.textContent = result?.message || 'Unable to send message.';
      form.querySelector('button[type="submit"]').disabled = false;
      return;
    }

    textarea.value = '';
    statusNode.textContent = 'Message sent. Your support team will reply here shortly.';
    await loadMessages();
    form.querySelector('button[type="submit"]').disabled = false;
  });

  if (refreshButton) {
    refreshButton.addEventListener('click', loadMessages);
  }
}

async function populateRecipientOptions() {
  const select = document.getElementById('clientMessageRecipient');
  select.innerHTML = '<option value="">Loading recipients...</option>';

  let recipients = [];
  try {
    recipients = await fetchMessageRecipients();
  } catch (err) {
    console.error('Unable to load message recipients', err);
  }

  if (!Array.isArray(recipients) || !recipients.length) {
    const adminRecipient = await fetchDefaultAdminRecipient();
    if (adminRecipient) {
      recipients = [adminRecipient];
    } else {
      const fallbackAdminId = Number(window.APP_CONFIG?.DEFAULT_ADMIN_ID || 1);
      recipients = [{ id: fallbackAdminId, label: 'SMSi Admin Team', role: 'admin' }];
    }
  }

  if (!recipients.length) {
    select.innerHTML = '<option value="">No recipients available</option>';
    return;
  }

  select.innerHTML = ['<option value="">Choose recipient</option>',
    ...recipients.map((recipient) => {
      const recipientRole = String(recipient.role || '').trim().toLowerCase();
      const label = recipient.label || (recipientRole === 'admin'
        ? 'SMSi Admin Team'
        : `Head of ${recipient.department_name || 'Department'} (${recipient.name})`);
      return `<option value="${recipient.id}">${label}</option>`;
    })
  ].join('');
}

async function fetchDefaultAdminRecipient() {
  const res = await apiRequest('/messages/default-admin');
  if (res?.success && res.admin_id) {
    return { id: Number(res.admin_id), label: 'SMSi Admin Team', role: 'admin' };
  }
  return null;
}
