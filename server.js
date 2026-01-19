const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const bodyParser = require('body-parser'); // เพิ่ม body-parser สำหรับจัดการข้อมูล
const cors = require('cors'); // เพิ่ม CORS เพื่อให้ frontend เรียก API ได้ในบางกรณี

// Use body-parser middleware for parsing request bodies
app.use(bodyParser.json());
app.use(cors()); // Enable CORS

// Determine database path for Render or local environment
const dbPath = process.env.RENDER_DISK_MOUNT_PATH 
    ? `${process.env.RENDER_DISK_MOUNT_PATH}/database.db` 
    : './database.db';

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Drop existing table if you want a clean start with new schema (CAUTION: deletes all data)
    // db.run(`DROP TABLE IF EXISTS loans`);
    // db.run(`DROP TABLE IF EXISTS settings`);

    // Create or update loans table schema
    db.run(`CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        type TEXT,       -- 'เพิ่ม', 'ลด', 'ดอกเบี้ย'
        amount REAL,     -- จำนวนเงินในรายการนั้นๆ
        balance REAL,    -- ยอดคงเหลือทั้งหมด (รวมดอกเบี้ยที่คิดแล้ว)
        principal_balance REAL, -- ยอดเงินต้นคงเหลือ (ไม่รวมดอกเบี้ย)
        interest_accrued REAL,  -- ดอกเบี้ยที่เกิดจากรายการนี้
        notes TEXT,
        interest_rate REAL      -- อัตราดอกเบี้ยที่ใช้ ณ วันนั้น
    )`);

    // Create settings table for dynamic config
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // Initialize default settings if not exist
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('interestRate', '5')`); // 5% ต่อเดือน
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('startDate', '${new Date().toISOString().split('T')[0]}')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('borrowerName', 'ผู้กู้เริ่มต้น')`);
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API: Get all loan transactions
app.get('/api/loans', (req, res) => {
    db.all("SELECT * FROM loans ORDER BY date DESC, id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: Add a new loan transaction
app.post('/api/loans', (req, res) => {
    const { date, type, amount, balance, principal_balance, interest_accrued, notes, interest_rate } = req.body;
    const sql = `INSERT INTO loans (date, type, amount, balance, principal_balance, interest_accrued, notes, interest_rate) VALUES (?,?,?,?,?,?,?,?)`;
    db.run(sql, [date, type, amount, balance, principal_balance, interest_accrued || 0, notes, interest_rate || 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// API: Get settings
app.get('/api/settings', (req, res) => {
    db.all("SELECT key, value FROM settings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    });
});

// API: Update settings
app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    const sql = `INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)`;
    db.run(sql, [key, value], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Settings updated" });
    });
});

// API: Reset all data
app.delete('/api/reset', (req, res) => {
    db.run("DELETE FROM loans", (err) => {
        if (err) return res.status(500).json({ error: err.message });
        // Reset settings to default after clearing loans
        db.run("DELETE FROM settings", (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('interestRate', '5')`);
            db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('startDate', '${new Date().toISOString().split('T')[0]}')`);
            db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('borrowerName', 'ผู้กู้เริ่มต้น')`);
            res.json({ message: "Reset complete" });
        });
    });
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));