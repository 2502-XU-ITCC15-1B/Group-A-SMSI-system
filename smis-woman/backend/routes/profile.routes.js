const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const authService = require('../services/auth.service');
const { authenticate } = require('../middleware/auth');

// Require authentication for all profile routes
router.use(authenticate);

// Multer storage for user avatars
const profileStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'users'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extAllowed = /\.(jpe?g|png|gif|bmp|webp|svg)$/i.test(path.extname(file.originalname));
    const typeAllowed = /image\//i.test(file.mimetype);
    cb(extAllowed && typeAllowed ? null : new Error('Only image files (JPG, PNG, GIF, BMP, WEBP, SVG) are allowed.'));
  }
});

// Ensure uploads/users folder exists (server may already create uploads root)
// If needed create the folder on startup in server.js — otherwise multer will create it when writing.

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PUT /api/profile
router.put('/', async (req, res) => {
  try {
    const user = await authService.updateMe(req.user.id, req.body);
    res.json({ success: true, message: 'Profile updated successfully.', user });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PATCH /api/profile/password
router.patch('/password', async (req, res) => {
  try {
    const result = await authService.changePassword(
      req.user.id,
      req.body.current_password,
      req.body.new_password
    );

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PATCH /api/profile/avatar
// Body: multipart/form-data { avatar }
// Saves uploaded file to uploads/users/<filename> and stores filename in users.profile_picture
router.patch('/avatar', profileUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const filename = req.file.filename;

    await pool.query('UPDATE users SET profile_picture = $1 WHERE id = $2', [filename, req.user.id]);

    const user = await authService.getMe(req.user.id);

    res.json({ success: true, message: 'Avatar uploaded successfully.', user });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
