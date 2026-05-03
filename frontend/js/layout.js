// ============================================================
// Centralized layout renderer for the App frontend.
// مسؤle for generating reusable UI components like sidebar
// and top navigation bar based on user role and context.
//
// Usage:
//   AppLayout.sidebar(role, activePage)
//   AppLayout.topbar(breadcrumbsArray)
// ============================================================

window.AppLayout = {

  // ── SIDEBAR ───────────────────────────────────────────────
  // sidebar(role, active)
  // Generates the sidebar navigation based on user role.
  // Highlights the currently active page.
  sidebar(role, active) {

    // Navigation items per role
    const items = {
      client: [
        ['dashboard', 'Dashboard', '/client/dashboard.html'],
        ['list_alt', 'My Requests', '/client/requests.html'],
        ['person', 'Profile', '/client/profile.html']
      ],
      technician: [
        ['dashboard', 'Dashboard', '/technician/dashboard.html'],
        ['confirmation_number', 'My Tickets', '/technician/my-tickets.html'],
        ['history', 'Activity', '/technician/activity.html'],
        ['person', 'Profile', '/technician/profile.html']
      ],
      head: [
        ['dashboard', 'Dashboard', '/head/dashboard.html'],
        ['confirmation_number', 'Tickets', '/head/tickets.html'],
        ['history', 'Activity', '/head/activity.html'],
        ['person', 'Profile', '/head/profile.html']
      ],
      admin: [
        ['dashboard', 'Dashboard', '/admin/dashboard.html'],
        ['confirmation_number', 'Tickets', '/admin/tickets.html'],
        ['group', 'Users', '/admin/users.html'],
        ['domain', 'Companies', '/admin/companies.html'],
        ['apartment', 'Departments', '/admin/departments.html'],
        ['bar_chart', 'Reports', '/admin/reports.html'],
        ['history', 'Activity Log', '/admin/activity.html'],
        ['person', 'Settings', '/admin/profile.html']
      ]
    };

    return `
      <aside class="sidebar">
        <div class="brand">
          <img src="/assets/logo.png" alt="SMSi">
          <div>
            <strong>SMSi</strong>
            <span>${role} portal</span>
          </div>
        </div>

        <nav>
          ${items[role].map(([icon, label, href]) => `
            <a class="nav-item ${active === label ? 'active' : ''}" href="${href}">
              <span class="material-symbols-outlined">${icon}</span>
              <span>${label}</span>
            </a>
          `).join('')}
        </nav>
      </aside>
    `;
  },

  // ── TOPBAR ────────────────────────────────────────────────
  // topbar(breadcrumbs)
  // Renders the top navigation bar with breadcrumbs and actions.
  // breadcrumbs: array of strings (e.g. ['Dashboard', 'Tickets'])
  topbar(breadcrumbs = []) {

    return `
      <header class="topbar">

        <div class="topbar-left">
          <!-- Sidebar toggle button -->
          <button class="icon-btn" data-action="toggle-sidebar">☰</button>

          <!-- App brand / home link -->
          <a class="brand-link" href="/index.html">SMSi</a>

          <!-- Breadcrumb navigation -->
          <nav class="breadcrumbs">
            ${breadcrumbs.map((item, index) => `
              <span class="crumb ${index === breadcrumbs.length - 1 ? 'current' : ''}">
                ${index > 0 ? '>' : ''}
                ${item}
              </span>
            `).join('')}
          </nav>
        </div>

        <div class="topbar-right">
          <!-- Notifications button -->
          <button class="icon-btn" data-action="notifications">🔔</button>

          <!-- User menu button -->
          <button class="icon-btn" data-action="user-menu">👤</button>
        </div>

      </header>
    `;
  }
};
