const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer'); 
const path = require('path'); 
const fs = require('fs'); 
const bcrypt = require('bcrypt');

require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- การตั้งค่า Multer ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); 
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- การตั้งค่า Database Pool ---
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'test_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- 1. Authentication สำหรับลูกค้า ---
app.post('/api/register', async (req, res) => {
    const { fullName, phone, email, password, address } = req.body;
    if (!phone || !password) return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = "INSERT INTO users (full_name, phone, email, password, address) VALUES (?, ?, ?, ?, ?)";
        db.query(sql, [fullName, phone, email, hashedPassword, address], (err) => {
            if (err) return res.status(400).json({ message: "เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว" });
            res.json({ status: "success", message: "สมัครสมาชิกสำเร็จ!" });
        });
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.post('/api/user-login', (req, res) => {
    const { phone, password } = req.body;
    const sql = "SELECT * FROM users WHERE phone = ?";
    db.query(sql, [phone], async (err, data) => {
        if (err || data.length === 0) return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });
        const match = await bcrypt.compare(password, data[0].password);
        if (match) {
            res.json({ status: "success", user: { id: data[0].id, fullName: data[0].full_name, phone: data[0].phone } });
        } else {
            res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
        }
    });
});

// --- 2. Authentication สำหรับ Admin ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = "SELECT username, full_name FROM admins WHERE username = ? AND password = ?";
    db.query(sql, [username, password], (err, data) => {
        if (data.length > 0) res.json({ status: "success", user: data[0] });
        else res.status(401).json({ message: "Login Fail" });
    });
});

// --- 3. API การจองและจัดการข้อมูล ---

// ดึงข้อมูลทั้งหมด (Admin)
app.get('/api/all-bookings', (req, res) => {
    const sql = "SELECT *, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date FROM bookings ORDER BY id DESC";
    db.query(sql, (err, data) => res.json(data));
});

// เพิ่มการจองใหม่
app.post('/api/booking', upload.single('image'), (req, res) => {
    const { customer_name, phone, service_type, booking_date, booking_time, address_detail, notes } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const sql = "INSERT INTO bookings (customer_name, phone, service_type, booking_date, booking_time, address_detail, notes, status, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, 'รอยืนยัน', ?)";
    db.query(sql, [customer_name, phone, service_type, booking_date, booking_time, address_detail, notes, image_url], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "สำเร็จ", id: result.insertId });
    });
});

// ✅ แก้ไขข้อมูลการจอง (PUT)
app.put('/api/booking/:id', (req, res) => {
    const { id } = req.params;
    const { customer_name, phone, service_type, booking_date, booking_time, address_detail, sub_district, district, province, postcode, notes } = req.body;
    const sql = `UPDATE bookings SET customer_name=?, phone=?, service_type=?, booking_date=?, booking_time=?, address_detail=?, sub_district=?, district=?, province=?, postcode=?, notes=? WHERE id=?`;
    db.query(sql, [customer_name, phone, service_type, booking_date, booking_time, address_detail, sub_district, district, province, postcode, notes, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "success", message: "แก้ไขข้อมูลสำเร็จ" });
    });
});

// ✅ แก้ไขส่วนเปลี่ยนสถานะ (ทำให้รองรับ URL จากหน้าบ้าน)
app.patch('/api/booking/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = "UPDATE bookings SET status = ? WHERE id = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "success", message: "เปลี่ยนสถานะสำเร็จ" });
    });
});

// ✅ ลบรายการจอง (DELETE)
app.delete('/api/booking/:id', (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM bookings WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "success", message: "ลบรายการสำเร็จ" });
    });
});

app.get('/api/my-booking/:phone', (req, res) => {
    const { phone } = req.params;
    db.query("SELECT *, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date FROM bookings WHERE phone = ?", [phone], (err, data) => res.json(data));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));