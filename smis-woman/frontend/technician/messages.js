let messagesUser = null;
let messageThread = [];

document.addEventListener('DOMContentLoaded', async () => {
  messagesUser = await Auth.requireRoleAsync('technician', 'head');
  if (!messagesUser) return;

  TechnicianPortal.configureShell(messagesUser, 'messages');
  bindMessageEvents();
  await loadMessages();
});

function bindMessageEvents() {
  document.getElementById('messageForm').addEventListener('submit', handleSendMessage);
  document.getElementById('refreshBtn').addEventListener('click', loadMessages);
  document.getElementById('refreshThreadBtn').addEventListener('click', loadMessages);
}

async function loadMessages() {
  setMessagesMessage('Loading messages...');

  try {
    const messages = await fetchUserMessages(messagesUser.id);
    messageThread = Array.isArray(messages) ? messages : [];
    renderMessageThread();
    setMessagesMessage(messageThread.length ? '' : 'No messages yet. Send your first message to admin.', '');
  } catch (error) {
    console.error(error);
    setMessagesMessage('Unable to load messages.', 'error');
  }
}

function renderMessageThread() {
  const threadContainer = document.getElementById('messageThread');
  if (!threadContainer) return;

  if (!messageThread.length) {
    threadContainer.innerHTML = '<li class="message-empty">No conversation found yet. Send a message to start your private admin thread.</li>';
    return;
  }

  threadContainer.innerHTML = messageThread.map((message) => {
    const isSent = Number(message.sender_id) === Number(messagesUser.id);
    const author = isSent ? 'You' : (message.sender_name || 'Administrator');
    const timestamp = formatDateTime(message.created_at);
    const body = TechnicianPortal.escapeHtml(message.message || '');

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
}

async function handleSendMessage(event) {
  event.preventDefault();
  const textarea = document.getElementById('newMessage');
  const messageText = textarea.value.trim();

  if (!messageText) {
    setMessagesMessage('Please type a message before sending.', 'error');
    return;
  }

  setMessagesMessage('Sending message...');
  try {
    const defaultAdmin = (window.APP_CONFIG && window.APP_CONFIG.DEFAULT_ADMIN_ID) ? window.APP_CONFIG.DEFAULT_ADMIN_ID : 1;
    const payload = {
      receiver_id: defaultAdmin,
      message: messageText
    };
    const response = await sendMessage(payload);
    if (!response?.success) {
      setMessagesMessage(response?.message || 'Unable to send message.', 'error');
      return;
    }

    textarea.value = '';
    await loadMessages();
    setMessagesMessage('Message sent successfully.', 'success');
  } catch (error) {
    console.error(error);
    setMessagesMessage('Unable to send message.', 'error');
  }
}

function setMessagesMessage(message, type = '') {
  const node = document.getElementById('messagesMessage');
  if (!node) return;
  node.textContent = message;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}
