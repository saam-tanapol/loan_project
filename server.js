const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const dbPath = process.env.RENDER_DISK_MOUNT_PATH 
    ? `${process.env.RENDER_DISK_MOUNT_PATH}/database.db` 
    : './database.db';

const db = new sqlite3.Database(dbPath);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// สร้าง Table ตาม Schema ที่กำหนด
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        type TEXT, 
        amount REAL,
        balance REAL,
        interest REAL,
        notes TEXT
    )`);
});

// ดึงข้อมูลทั้งหมด
app.get('/api/loans', (req, res) => {
    db.all("SELECT * FROM loans ORDER BY date DESC, id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// เพิ่มรายการใหม่
app.post('/api/loans', (req, res) => {
    const { date, type, amount, balance, interest, notes } = req.body;
    const sql = `INSERT INTO loans (date, type, amount, balance, interest, notes) VALUES (?,?,?,?,?,?)`;
    db.run(sql, [date, type, amount, balance, interest, notes], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// ล้างข้อมูลทั้งหมด
app.delete('/api/reset', (req, res) => {
    db.run("DELETE FROM loans", (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Reset complete" });
    });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));