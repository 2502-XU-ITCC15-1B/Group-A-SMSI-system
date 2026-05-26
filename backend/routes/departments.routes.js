const express            = require('express');
const router             = express.Router();
const departmentService  = require('../services/department.service');
const { authenticate, authorize } = require('../middleware/auth');

// GET    /api/departments
// Roles: admin, technician, head, client
// → list all departments
router.get(
  '/',
  authenticate,
  authorize('admin', 'technician', 'head', 'client'),
  async (req, res) => {
    try {
      const departments = await departmentService.getAll();
      res.json({ success: true, departments });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// GET    /api/departments/:id
// Roles: admin, head
// → get department by ID
router.get(
  '/:id',
  authenticate,
  authorize('admin', 'head'),
  async (req, res) => {
    try {
      const department = await departmentService.getById(req.params.id);
      res.json({ success: true, department });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// POST   /api/departments
// Roles: admin
// Body: { name, manager_id? }
// → create a new department
router.post(
  '/',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const department = await departmentService.create(req.body, req.user.id);
      res.status(201).json({ success: true, department });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// PUT    /api/departments/:id
// Roles: admin
// → update department
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const result = await departmentService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// DELETE /api/departments/:id
// Roles: admin
// → remove department
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const result = await departmentService.remove(
        req.params.id,
        req.user.id
      );
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message
      });
    }
  }
);

module.exports = router;
