const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/mongo');

const app = express();

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://www.moorthyvk.online",
    "https://one2-mti6.onrender.com"
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leaves');
const dashboardRoutes = require('./routes/dashboard');
const taskRoutes = require('./routes/tasks');
const calendarRoutes = require('./routes/calendar');
const adminRoutes = require('./routes/admin');
const groupRoutes = require('./routes/groups');
const privateMessageRoutes = require('./routes/privateMessages');
const eventRoutes = require('./routes/events');
const notificationRoutes = require('./routes/notifications');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/private-messages', privateMessageRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'GenLab API is running' });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ── HTTP + Socket.io Setup ──────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://www.moorthyvk.online",
      "https://one2-mti6.onrender.com"
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to route handlers (e.g. file upload emits)
app.set('io', io);

// Attach Socket.io event handlers
const initSocket = require('./socket/index');
initSocket(io);

// ── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function main() {
  await connectDB();

  httpServer.listen(PORT, () => {
    console.log(`🚀 GenLab server running on port ${PORT}`);
    console.log(`📍 API available at http://localhost:${PORT}/api`);
    console.log(`🔌 Socket.io ready`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
