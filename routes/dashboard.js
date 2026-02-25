'use strict';

const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const User = require('../models/User');
const Task = require('../models/Task');

const { authenticateToken, isAdmin } = require('../middleware/auth');

function todayIST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'YYYY-MM-DD'
}

function yearMonthIST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 7); // 'YYYY-MM'
}

// ── GET /api/dashboard/admin/stats ────────────────────────────────────────────
router.get('/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const today = todayIST();
        const yearMonth = yearMonthIST();

        const [
            totalUsers,
            activeUsers,
            todayAttendance,
            presentToday,
            pendingLeaves,
            approvedLeavesThisMonth,
            totalTasks
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ status: 'active' }),
            Attendance.countDocuments({ date: today }),
            Attendance.countDocuments({ date: today, status: 'present' }),
            Leave.countDocuments({ status: 'pending' }),
            Leave.countDocuments({
                status: 'approved',
                start_date: { $regex: `^${yearMonth}` }
            }),
            Task.countDocuments()
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                todayAttendance,
                presentToday,
                pendingLeaves,
                approvedLeavesThisMonth,
                totalTasks
            }
        });
    } catch (error) {
        console.error('Dashboard admin stats error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/dashboard/employee/stats ─────────────────────────────────────────
router.get('/employee/stats', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const today = todayIST();
        const yearMonth = yearMonthIST();

        const [
            totalAttendance,
            presentThisMonth,
            totalLeaves,
            pendingLeaves,
            approvedLeaves,
            todayRec
        ] = await Promise.all([
            Attendance.countDocuments({ user: userId }),
            Attendance.countDocuments({ user: userId, status: 'present', date: { $regex: `^${yearMonth}` } }),
            Leave.countDocuments({ user: userId }),
            Leave.countDocuments({ user: userId, status: 'pending' }),
            Leave.countDocuments({ user: userId, status: 'approved' }),
            Attendance.findOne({ user: userId, date: today })
        ]);

        res.json({
            success: true,
            stats: {
                totalAttendance,
                presentThisMonth,
                totalLeaves,
                pendingLeaves,
                approvedLeaves,
                attendanceToday: todayRec ? todayRec.toJSON() : null
            }
        });
    } catch (error) {
        console.error('Dashboard employee stats error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/dashboard/admin/recent-activities ────────────────────────────────
router.get('/admin/recent-activities', authenticateToken, isAdmin, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    try {
        const [attendanceRecs, leaveRecs] = await Promise.all([
            Attendance.find()
                .populate('user', 'name')
                .sort({ createdAt: -1 })
                .limit(limit),
            Leave.find()
                .populate('user', 'name')
                .sort({ createdAt: -1 })
                .limit(limit)
        ]);

        const activities = [
            ...attendanceRecs.map(a => ({
                type: 'attendance',
                id: a._id.toString(),
                activity_date: a.date,
                status: a.status,
                user_name: a.user?.name || 'Unknown',
                created_at: a.createdAt
            })),
            ...leaveRecs.map(l => ({
                type: 'leave',
                id: l._id.toString(),
                activity_date: l.start_date,
                status: l.status,
                user_name: l.user?.name || 'Unknown',
                created_at: l.createdAt
            }))
        ]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);

        res.json({ success: true, activities });
    } catch (error) {
        console.error('Recent activities error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/dashboard/activity ──────────────────────────────────────────────
router.get('/activity', authenticateToken, async (req, res) => {
    try {
        const limit = 20;
        const filter = req.user.role === 'employee' ? { user: req.user.id } : {};
        const taskFilter = req.user.role === 'employee' ? { assigned_to: req.user.id, status: 'completed' } : { status: 'completed' };
        const standupFilter = req.user.role === 'employee' ? { userId: req.user.id } : {};

        const [attendanceRecs, leaveRecs, taskRecs, standupRecs, userRecs] = await Promise.all([
            Attendance.find(filter)
                .populate('user', 'name')
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean(),
            Leave.find(filter)
                .populate('user', 'name')
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean(),
            require('../models/Task').find(taskFilter)
                .populate('assigned_to', 'name')
                .sort({ completed_at: -1, updatedAt: -1 })
                .limit(limit)
                .lean(),
            require('../models/Standup').find(standupFilter)
                .populate('userId', 'name')
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean(),
            req.user.role === 'admin'
                ? User.find().sort({ createdAt: -1 }).limit(limit).lean()
                : Promise.resolve([])
        ]);

        const activities = [
            ...attendanceRecs.map(a => ({
                type: 'attendance',
                message: `${a.user?.name || 'Someone'} ${a.check_out_time ? 'clocked out' : 'clocked in'}`,
                timestamp: a.createdAt
            })),
            ...leaveRecs.map(l => ({
                type: 'leave',
                message: `Leave request for ${l.user?.name || 'Someone'} was ${l.status}`,
                timestamp: l.updatedAt || l.createdAt
            })),
            ...taskRecs.map(t => ({
                type: 'task',
                message: `${t.assigned_to?.name || 'Someone'} completed task: ${t.title}`,
                timestamp: t.completed_at || t.updatedAt
            })),
            ...standupRecs.map(s => ({
                type: 'standup',
                message: `${s.userId?.name || 'Someone'} submitted daily standup`,
                timestamp: s.createdAt
            })),
            ...userRecs.map(u => ({
                type: 'user',
                message: `New user created: ${u.name} (${u.role})`,
                timestamp: u.createdAt
            }))
        ];

        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json({ success: true, activities: activities.slice(0, limit) });
    } catch (error) {
        console.error('Unified dashboard activity error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/dashboard/analytics ──────────────────────────────────────────────
router.get('/analytics', authenticateToken, async (req, res) => {
    try {
        const today = todayIST();
        const yearMonth = yearMonthIST();

        // Start of this week (Monday) in IST
        const now = new Date();
        const istDateStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const istDate = new Date(istDateStr);

        const day = istDate.getDay();
        const diff = istDate.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(istDate);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfWeekStr = startOfWeek.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        // Filters
        const userFilter = req.user.role === 'employee' ? { assigned_to: req.user.id } : {};
        const attendFilter = req.user.role === 'employee' ? { user: req.user.id } : {};
        const leaveFilter = req.user.role === 'employee' ? { user: req.user.id } : {};
        const standupFilter = req.user.role === 'employee' ? { userId: req.user.id } : {};

        const [
            tasksCompletedWeek,
            leavesThisMonth,
            attendanceWeek,
            standupsToday,
            totalEmployees
        ] = await Promise.all([
            Task.countDocuments({
                ...userFilter,
                status: 'completed',
                completed_at: { $gte: startOfWeek }
            }),
            Leave.find({
                ...leaveFilter,
                status: 'approved',
                start_date: { $regex: `^${yearMonth}` }
            }).select('days'),
            Attendance.find({
                ...attendFilter,
                date: { $gte: startOfWeekStr },
                totalHours: { $ne: null }
            }).select('totalHours'),
            require('../models/Standup').countDocuments({ date: today }),
            User.countDocuments({ role: 'employee', status: 'active' })
        ]);

        const totalLeaveDays = leavesThisMonth.reduce((sum, l) => sum + (l.days || 0), 0);
        const avgHours = attendanceWeek.length > 0
            ? (attendanceWeek.reduce((sum, a) => sum + (a.totalHours || 0), 0) / attendanceWeek.length).toFixed(1)
            : 0;
        const standupRate = totalEmployees > 0
            ? Math.round((standupsToday / totalEmployees) * 100)
            : 0;

        res.json({
            success: true,
            analytics: {
                tasksCompletedWeek,
                totalLeaveDaysMonth: totalLeaveDays,
                avgHoursWeek: parseFloat(avgHours),
                standupRateToday: standupRate
            }
        });
    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
