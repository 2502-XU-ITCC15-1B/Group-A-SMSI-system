document.addEventListener('DOMContentLoaded', async () => {
  if (!requireRole('client')) return;

  await ClientPortal.hydrateClientSession();
  ClientPortal.initPage({
    activeNav: 'profile',
    title: 'Profile',
    subtitle: 'Manage your account details and password.',
    breadcrumbs: ['Client Portal', 'Profile']
  });

  bindProfileForm();
  bindPasswordForm();

  await loadProfile();
});

async function loadProfile() {
  const user = await getMe();

  if (!user) return;

  document.getElementById('name').value = user.name || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('role').value = user.role || 'client';
  document.getElementById('company').value = user.company_name || 'Not assigned';
}

function bindProfileForm() {
  const form = document.getElementById('profileForm');
  const button = document.getElementById('saveProfileBtn');
  const message = document.getElementById('profileMessage');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim()
    };

    button.disabled = true;
    button.textContent = 'Saving...';
    setFormMessage(message, '');

    try {
      const result = await updateProfile(payload);

      if (!result?.success) {
        setFormMessage(message, result?.message || 'Unable to update profile.', 'error');
        return;
      }

      sessionStorage.setItem('woman_user', JSON.stringify(result.user));
      sessionStorage.setItem('woman_role', result.user.role || 'client');
      setFormMessage(message, 'Profile updated successfully.', 'success');
      await loadProfile();
    } finally {
      button.disabled = false;
      button.textContent = 'Save Changes';
    }
  });
}

function bindPasswordForm() {
  const form = document.getElementById('passwordForm');
  const button = document.getElementById('changePasswordBtn');
  const message = document.getElementById('passwordMessage');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      current_password: document.getElementById('currentPassword').value,
      new_password: document.getElementById('newPassword').value
    };

    button.disabled = true;
    button.textContent = 'Updating...';
    setFormMessage(message, '');

    try {
      const result = await changePassword(payload);

      if (!result?.success) {
        setFormMessage(message, result?.message || 'Unable to update password.', 'error');
        return;
      }

      form.reset();
      setFormMessage(message, 'Password updated successfully.', 'success');
    } finally {
      button.disabled = false;
      button.textContent = 'Update Password';
    }
  });
}

function setFormMessage(node, text, type = '') {
  node.textContent = text;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}
