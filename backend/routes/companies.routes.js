const express4       = require('express');
const router4        = express4.Router();
const companyService = require('../services/company.service');
const { authenticate: auth4, authorize: authz4 } = require('../middleware/auth');

router4.use(auth4, authz4('admin'));

// GET    /api/companies
router4.get('/', async (req, res) => {
  try {
    const companies = await companyService.getAll();
    res.json({ success: true, companies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET    /api/companies/:id
router4.get('/:id', async (req, res) => {
  try {
    const company = await companyService.getById(req.params.id);
    res.json({ success: true, company });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// POST   /api/companies
// Body: { name, contact_person, contact_email }
router4.post('/', async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ success: false, message: 'Company name is required.' });
    }
    const company = await companyService.create(req.body);
    res.status(201).json({ success: true, company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH  /api/companies/:id
router4.patch('/:id', async (req, res) => {
  try {
    const result = await companyService.update(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router4;