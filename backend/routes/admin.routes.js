const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const pool = require('../config/db');

router.use(authenticate, authorize('admin'));

// GET /api/admin/dashboard
router.get('/dashboard', async (_req, res) => {
  try {
    const [[ticketStats], [userStats], [companyStats], [departmentStats]] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_tickets,
          SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open_tickets,
          SUM(CASE WHEN status IN ('Assigned', 'In Progress') THEN 1 ELSE 0 END) AS in_progress_tickets,
          SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS resolved_tickets
        FROM tickets
        WHERE is_deleted = 0
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total_users,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users
        FROM users
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total_companies,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_companies
        FROM companies
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total_departments,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_departments
        FROM departments
      `)
    ]);

    res.json({
      success: true,
      totalTickets: ticketStats[0].total_tickets,
      openTickets: ticketStats[0].open_tickets || 0,
      inProgressTickets: ticketStats[0].in_progress_tickets || 0,
      resolvedTickets: ticketStats[0].resolved_tickets || 0,
      totalUsers: userStats[0].total_users,
      activeUsers: userStats[0].active_users || 0,
      totalCompanies: companyStats[0].total_companies,
      activeCompanies: companyStats[0].active_companies || 0,
      totalDepartments: departmentStats[0].total_departments,
      activeDepartments: departmentStats[0].active_departments || 0
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// GET /api/admin/reports
router.get('/reports', async (_req, res) => {
  try {
    const [[ticketMetrics], [priorityBreakdown], [companyBreakdown], [departmentBreakdown]] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_tickets,
          SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open_tickets,
          SUM(CASE WHEN status IN ('Assigned', 'In Progress') THEN 1 ELSE 0 END) AS active_tickets,
          SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS completed_tickets
        FROM tickets
        WHERE is_deleted = 0
      `),
      pool.query(`
        SELECT priority, COUNT(*) AS count
        FROM tickets
        WHERE is_deleted = 0
        GROUP BY priority
        ORDER BY FIELD(priority, 'Critical', 'High', 'Medium', 'Low')
      `),
      pool.query(`
        SELECT c.name, COUNT(t.id) AS ticket_count
        FROM companies c
        LEFT JOIN tickets t ON t.company_id = c.id AND t.is_deleted = 0
        GROUP BY c.id, c.name
        ORDER BY ticket_count DESC, c.name ASC
      `),
      pool.query(`
        SELECT d.name, COUNT(t.id) AS ticket_count
        FROM departments d
        LEFT JOIN tickets t ON t.department_id = d.id AND t.is_deleted = 0
        GROUP BY d.id, d.name
        ORDER BY ticket_count DESC, d.name ASC
      `)
    ]);

    res.json({
      success: true,
      overview: ticketMetrics[0],
      priorityBreakdown,
      companyBreakdown,
      departmentBreakdown
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
