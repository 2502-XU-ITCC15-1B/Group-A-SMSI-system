const pool = require('../config/db');
const logService = require('./log.service');

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
  const normalized = normalizeName(name);
  if (!normalized) return false;

  const words = normalized.split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  if (!words.every((word) => /^[A-Z][a-z]+$/.test(word))) return false;

  const lower = normalized.toLowerCase();
  return !CORPORATE_KEYWORDS.some((term) => lower.includes(term));
}

async function validateCompanyName(name) {
  const normalized = normalizeName(name);
  if (!normalized) {
    throw { status: 400, message: 'Company name is required.' };
  }

  const [userRows] = await pool.query(
    'SELECT id FROM users WHERE LOWER(name) = $1 LIMIT 1',
    [normalized.toLowerCase()]
  );
  if (userRows.length) {
    throw { status: 400, message: 'Company name conflicts with an existing user name.' };
  }

  if (looksLikePersonName(normalized)) {
    throw { status: 400, message: 'Company name appears to be a personal name. Please use an actual corporate name.' };
  }

  return normalized;
}

// -------------------------------------------------------
// Business logic for managing client companies (admin-only).
// -------------------------------------------------------

const getAll = async () => {
  const [rows] = await pool.query(
    `SELECT c.*,
            COUNT(DISTINCT u.id) AS user_count,
            COUNT(DISTINCT t.id) AS ticket_count
     FROM companies c
     LEFT JOIN users u ON u.company_id = c.id
     LEFT JOIN tickets t ON t.company_id = c.id AND t.is_deleted = 0
     GROUP BY c.id
     ORDER BY c.name ASC`
  );
  return rows;
};

const getById = async (id) => {
  const [rows] = await pool.query(
    'SELECT * FROM companies WHERE id = $1',
    [id]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'Company not found.' };
  }

  return rows[0];
};

const create = async ({ name, contact_person, contact_email, is_active = 1 }, adminId = null) => {
  const normalizedName = await validateCompanyName(name);
  const [result] = await pool.query(
    `INSERT INTO companies (name, contact_person, contact_email, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [normalizedName, contact_person || null, contact_email || null, is_active ? 1 : 0]
  );

  if (adminId) {
    await logService.record({
      userId: adminId,
      action: 'COMPANY_CREATED',
      details: `Company "${name}" created.`
    });
  }

  return { id: result.id, name };
};

const update = async (id, data, adminId = null) => {
  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    data.name = await validateCompanyName(data.name);
  }

  const [result] = await pool.query(
    `UPDATE companies
     SET name = COALESCE($1, name),
         contact_person = COALESCE($2, contact_person),
         contact_email = COALESCE($3, contact_email),
         is_active = COALESCE($4, is_active)
     WHERE id = $5`,
    [
      data.name || null,
      data.contact_person || null,
      data.contact_email || null,
      data.is_active ?? null,
      id
    ]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Company not found.' };
  }

  if (adminId) {
    await logService.record({
      userId: adminId,
      action: 'COMPANY_UPDATED',
      details: `Company ID ${id} updated.`
    });
  }

  return { success: true, message: 'Company updated.' };
};

const remove = async (id, adminId = null) => {
  await pool.query(
    'UPDATE companies SET is_active = 0 WHERE id = $1',
    [id]
  );

  if (adminId) {
    await logService.record({
      userId: adminId,
      action: 'COMPANY_DEACTIVATED',
      details: `Company ID ${id} deactivated.`
    });
  }

  return { success: true, message: 'Company deactivated.' };
};

module.exports = { getAll, getById, create, update, remove };
