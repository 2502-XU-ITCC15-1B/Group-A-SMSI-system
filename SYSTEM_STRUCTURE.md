# System Structure

## Frontend

```text
frontend/
  _icons.html
  assets/
  admin/
    admin.js
    activity.html
    companies.html
    dashboard.html
    departments.html
    profile.html
    reports.html
    tickets.html
    users.html
  client/
    dashboard.html
    dashboard.js
    profile.html
    profile.js
    requests.html
    submit-ticket.html
    ticket-detail.html
    ticket-detail.js
  head/
    activity.html          -> redirect to /technician/activity.html
    dashboard.html         -> redirect to /technician/dashboard.html
    profile.html           -> redirect to /technician/profile.html
    ticket-detail.html     -> redirect to /technician/ticket-detail.html
    tickets.html           -> redirect to /technician/tickets.html
  js/
    api.js
    auth.js
    client.js
    config.js
    ui-modals.js
    utils.js
  styles/
    global.css
  technician/
    activity.html
    activity.js
    common.js
    dashboard.html
    dashboard.js
    my-tickets.html        -> redirect to /technician/tickets.html
    profile.html
    profile.js
    ticket-detail.html
    ticket-detail.js
    tickets.html
    tickets.js
```

## Backend

```text
backend/
  config/
  middleware/
  routes/
    admin.routes.js
    auth.routes.js
    companies.routes.js
    departments.routes.js
    logs.routes.js
    profile.routes.js
    tickets.routes.js
    users.routes.js
  services/
  database.sql
  server.js
```

## Active module rules

- `frontend/js/api.js` is the shared API layer for every role.
- `frontend/js/auth.js` owns session hydration and route protection.
- Admin pages are thin shells bootstrapped by `frontend/admin/admin.js`.
- Technician and head share the technician pages for dashboard, tickets, activity, detail, and profile. The old `frontend/head/` entry points remain only as compatibility redirects.
- Client pages stay under `frontend/client/`.
