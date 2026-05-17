const express        = require('express');
const router         = express.Router();
const companyService = require('../services/company.service');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const CORPORATE_KEYWORDS = [
  'company', 'inc', 'incorporated', 'corp', 'corporation', 'ltd', 'llc', 'group',
  'solutions', 'systems', 'services', 'technologies', 'tech', 'enterprise',
  'partners', 'studios', 'industries', 'holdings', 'international', 'global',
  'co', 'consulting', 'associates', 'ventures', 'works'
];

function normalizeName(value) {
  return String(value || '').trim();
}

function looksLikePersonName(name) {
  const value = normalizeName(name);
  if (!value) return false;

  const words = value.split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  if (!words.every((word) => /^[A-Z][a-z]+$/.test(word))) return false;

  const lower = value.toLowerCase();
  return !CORPORATE_KEYWORDS.some((term) => lower.includes(term));
}

async function validateCompanyName(name) {
  const normalized = normalizeName(name);
  if (!normalized) {
    throw { status: 400, message: 'Company name is required.' };
  }

  const nameLower = normalized.toLowerCase();
  const [userRows] = await pool.query(
    'SELECT id FROM users WHERE LOWER(name) = ? LIMIT 1',
    [nameLower]
  );
  if (userRows.length) {
    throw { status: 400, message: 'Company name conflicts with an existing user name.' };
  }

  if (looksLikePersonName(normalized)) {
    throw { status: 400, message: 'Company name appears to be a personal name. Please use an actual corporate name.' };
  }

  return normalized;
}

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
    req.body.name = await validateCompanyName(req.body.name);
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
    if (req.body.name) {
      req.body.name = await validateCompanyName(req.body.name);
    }

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