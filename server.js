const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 1. การตั้งค่า MongoDB Connection ---
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/test_db';
mongoose.connect(mongoURI)
    .then(() => console.log('🍃 Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB:', err));

// --- 2. การนิยาม Schema (ปรับตามรูปภาพที่ส่งมา) ---

// User Schema (ปรับตามรูป image_7b257a.png)
const userSchema = new mongoose.Schema({
    full_name: String, // ตามรูปใช้ full_name
    phone: mongoose.Schema.Types.Mixed, // ใช้ Mixed เพราะในรูปเป็นตัวเลข (สีน้ำเงิน)
    email: String,
    password: { type: String, required: true },
    address: String,
    created_at: String // ตามรูปใช้ created_at
}, { collection: 'users' }); // ระบุชื่อ collection ให้ตรงเป๊ะ

const User = mongoose.model('User', userSchema);

// Admin Schema (ปรับตามรูป image_7b25f7.png)
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: mongoose.Schema.Types.Mixed, // ในรูปเป็น Int32
    full_name: String,
    role: String
}, { collection: 'admins' });

const Admin = mongoose.model('Admin', adminSchema);

// Booking Schema (ปรับตามรูป image_7b259c.png)
const bookingSchema = new mongoose.Schema({
    customer_name: String,
    phone: mongoose.Schema.Types.Mixed, // ในรูปเป็นตัวเลข
    service_type: String,
    booking_date: mongoose.Schema.Types.Mixed, // ในรูปเป็นวันที่ยาวๆ
    booking_time: String,
    sub_district: String,
    district: String,
    province: String,
    postcode: mongoose.Schema.Types.Mixed,
    address_detail: String,
    status: String,
    notes: String,
    image_url: String,
    created_at: String
}, { collection: 'bookings' });

const Booking = mongoose.model('Booking', bookingSchema);

// --- 3. การตั้งค่า Multer ---
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

// --- 4. API Routes ---

// Login ลูกค้า (แก้ปัญหาเบอร์โทรเลข vs ข้อความ)
app.post('/api/user-login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        // ค้นหาโดยเช็คทั้งแบบเลขและข้อความ
        const user = await User.findOne({ 
            $or: [{ phone: phone }, { phone: Number(phone) }] 
        });

        if (!user) return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });

        // ตรวจสอบรหัสผ่าน (รองรับ bcrypt จากรูป image_7b257a)
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            res.json({ 
                status: "success", 
                user: { id: user._id, fullName: user.full_name, phone: user.phone } 
            });
        } else {
            res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
        }
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

// Login Admin (แก้ปัญหา password เป็นตัวเลข)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        
        // แปลง password ใน DB เป็น String ก่อนเทียบกับที่พิมพ์มา
        if (admin && String(admin.password) === String(password)) {
            res.json({ status: "success", user: admin });
        } else {
            res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
        }
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

// ดูการจองทั้งหมด (ใช้ created_at ตามรูป)
app.get('/api/all-bookings', async (req, res) => {
    try {
        const data = await Booking.find().sort({ created_at: -1 });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ดูรายการจองของฉัน
app.get('/api/my-booking/:phone', async (req, res) => {
    const { phone } = req.params;
    try {
        const data = await Booking.find({ 
            $or: [{ phone: phone }, { phone: Number(phone) }] 
        });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));