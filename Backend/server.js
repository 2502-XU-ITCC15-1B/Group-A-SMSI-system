const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "S3rv3r!Lock$992",
  database: "woman_db"
});

db.connect(err => {
  if (err) {
    console.log("Database connection failed:", err);
  } else {
    console.log("Connected to MySQL");
  }
});

app.get('/', (req, res) => {
  res.send('Backend is working');
});

app.post('/verify', (req, res) => {
  const { code } = req.body;

  const sql = "SELECT * FROM users WHERE password = ?";

  db.query(sql, [code], (err, result) => {
    if (err) {
      return res.json({ success: false, message: "Database error" });
    }

    if (result.length > 0) {
      res.json({ success: true, message: "Welcome to SMSI System!" });
    } else {
      res.json({ success: false, message: "Invalid Access Code!" });
    }
  });
});


app.listen(5000, () => {
  console.log("API running at http://localhost:5000");
});

