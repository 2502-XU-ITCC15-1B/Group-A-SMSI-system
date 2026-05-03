let profileUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  profileUser = await Auth.requireRoleAsync('technician', 'head');
  if (!profileUser) return;

  initializeProfileShell(profileUser);
  bindProfileEvents();
  await loadProfile();
});

function initializeProfileShell(user) {
  TechnicianPortal.configureShell(user, 'profile');
}

function bindProfileEvents() {
  document.getElementById('profileForm').addEventListener('submit', submitProfileUpdate);
  document.getElementById('passwordForm').addEventListener('submit', submitPasswordUpdate);
}

async function loadProfile() {
  const user = await getMe();
  if (!user) {
    setMessage(document.getElementById('profileMessage'), 'Unable to load profile.', 'error');
    return;
  }

  profileUser = user;
  sessionStorage.setItem('woman_user', JSON.stringify(user));
  sessionStorage.setItem('woman_role', user.role);

  document.getElementById('name').value = user.name || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('role').value = user.role || '-';
  document.getElementById('department').value = user.department_name || 'Not assigned';
  document.getElementById('sessionUserName').textContent = user.name || 'Unknown User';
  document.getElementById('sessionUserMeta').textContent = `${user.role}${user.department_name ? ` - ${user.department_name}` : ''}`;
  document.getElementById('portalLabel').textContent = user.role === 'head' ? 'department head portal' : 'technician portal';
}

async function submitProfileUpdate(event) {
  event.preventDefault();

  const button = document.getElementById('saveProfileBtn');
  const messageNode = document.getElementById('profileMessage');
  const payload = {
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim()
  };

  button.disabled = true;
  button.textContent = 'Saving...';
  setMessage(messageNode, '');

  try {
    const result = await updateProfile(payload);

    if (!result?.success) {
      setMessage(messageNode, result?.message || 'Unable to update profile.', 'error');
      return;
    }

    setMessage(messageNode, result.message || 'Profile updated successfully.', 'success');
    await loadProfile();
  } finally {
    button.disabled = false;
    button.textContent = 'Save Changes';
  }
}

async function submitPasswordUpdate(event) {
  event.preventDefault();

  const button = document.getElementById('changePasswordBtn');
  const messageNode = document.getElementById('passwordMessage');
  const payload = {
    current_password: document.getElementById('currentPassword').value,
    new_password: document.getElementById('newPassword').value
  };

  button.disabled = true;
  button.textContent = 'Updating...';
  setMessage(messageNode, '');

  try {
    const result = await changePassword(payload);

    if (!result?.success) {
      setMessage(messageNode, result?.message || 'Unable to change password.', 'error');
      return;
    }

    document.getElementById('passwordForm').reset();
    setMessage(messageNode, result.message || 'Password updated successfully.', 'success');
  } finally {
    button.disabled = false;
    button.textContent = 'Update Password';
  }
}

function setMessage(node, message, type = '') {
  node.textContent = message;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}
