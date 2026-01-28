const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const mongoURI = process.env.MONGO_URI;

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(mongoURI);
        console.log('🍃 Connected to MongoDB Atlas');
    } catch (err) {
        console.error('Could not connect to MongoDB:', err);
    }
};

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// --- 2. การนิยาม Schema (เหมือนเดิม) ---
const userSchema = new mongoose.Schema({
    full_name: String,
    phone: mongoose.Schema.Types.Mixed,
    email: String,
    password: { type: String, required: true },
    address: String,
    created_at: String
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: mongoose.Schema.Types.Mixed,
    full_name: String,
    role: String
}, { collection: 'admins' });

const Admin = mongoose.model('Admin', adminSchema);

const bookingSchema = new mongoose.Schema({
    customer_name: String,
    phone: mongoose.Schema.Types.Mixed,
    service_type: String,
    booking_date: mongoose.Schema.Types.Mixed,
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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = '/tmp'; 
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.get('/api/test', (req, res) => {
    res.json({ message: "Backend is running!" });
});

app.post('/api/user-login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await User.findOne({ 
            $or: [{ phone: phone }, { phone: Number(phone) }] 
        });
        if (!user) return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });

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

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (admin && String(admin.password) === String(password)) {
            res.json({ status: "success", user: admin });
        } else {
            res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
        }
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.get('/api/all-bookings', async (req, res) => {
    try {
        const data = await Booking.find().sort({ created_at: -1 });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/my-booking/:phone', async (req, res) => {
    const { phone } = req.params;
    try {
        const data = await Booking.find({ 
            $or: [{ phone: phone }, { phone: Number(phone) }] 
        });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
}

module.exports = app;