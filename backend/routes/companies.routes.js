const express        = require('express');
const router         = express.Router();
const companyService = require('../services/company.service');
const { authenticate, authorize } = require('../middleware/auth');

// All company management routes are admin-only
router.use(authenticate, authorize('admin'));

// GET    /api/companies
// → list all companies
router.get('/', async (req, res) => {
  try {
    const companies = await companyService.getAll();
    res.json({ success: true, companies });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// GET    /api/companies/:id
// → get company by ID
router.get('/:id', async (req, res) => {
  try {
    const company = await companyService.getById(req.params.id);
    res.json({ success: true, company });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// POST   /api/companies
// Body: { name, contact_person, contact_email }
// → create a new company
router.post('/', async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required.'
      });
    }

    const company = await companyService.create(req.body);
    res.status(201).json({ success: true, company });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PUT    /api/companies/:id
// → update company (full update)
router.put('/:id', async (req, res) => {
  try {
    const result = await companyService.update(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// DELETE /api/companies/:id
// → remove company
router.delete('/:id', async (req, res) => {
  try {
    const result = await companyService.remove(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;