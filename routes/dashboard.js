'use strict';

const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const User = require('../models/User');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// ── GET /api/dashboard/admin/stats ────────────────────────────────────────────
router.get('/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const [
            totalUsers,
            activeUsers,
            todayAttendance,
            presentToday,
            pendingLeaves,
            approvedLeavesThisMonth
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ status: 'active' }),
            Attendance.countDocuments({ date: today }),
            Attendance.countDocuments({ date: today, status: 'present' }),
            Leave.countDocuments({ status: 'pending' }),
            Leave.countDocuments({
                status: 'approved',
                start_date: { $regex: `^${yearMonth}` }
            })
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                todayAttendance,
                presentToday,
                pendingLeaves,
                approvedLeavesThisMonth
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
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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

module.exports = router;
