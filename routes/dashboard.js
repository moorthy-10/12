const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get dashboard statistics (Admin)
router.get('/admin/stats', authenticateToken, isAdmin, (req, res) => {
    const stats = {};

    // Total users count
    db.get('SELECT COUNT(*) as total FROM users', (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        stats.totalUsers = result.total;

        // Active users
        db.get('SELECT COUNT(*) as total FROM users WHERE status = "active"', (err, result) => {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            stats.activeUsers = result.total;

            // Total attendance today
            db.get('SELECT COUNT(*) as total FROM attendance WHERE date = DATE("now")', (err, result) => {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });
                stats.todayAttendance = result.total;

                // Present today
                db.get('SELECT COUNT(*) as total FROM attendance WHERE date = DATE("now") AND status = "present"', (err, result) => {
                    if (err) return res.status(500).json({ success: false, message: 'Database error' });
                    stats.presentToday = result.total;

                    // Pending leave requests
                    db.get('SELECT COUNT(*) as total FROM leaves WHERE status = "pending"', (err, result) => {
                        if (err) return res.status(500).json({ success: false, message: 'Database error' });
                        stats.pendingLeaves = result.total;

                        // Approved leaves this month
                        db.get(`
              SELECT COUNT(*) as total FROM leaves 
              WHERE status = "approved" 
              AND strftime('%Y-%m', start_date) = strftime('%Y-%m', 'now')
            `, (err, result) => {
                            if (err) return res.status(500).json({ success: false, message: 'Database error' });
                            stats.approvedLeavesThisMonth = result.total;

                            res.json({ success: true, stats });
                        });
                    });
                });
            });
        });
    });
});

// Get dashboard statistics (Employee)
router.get('/employee/stats', authenticateToken, (req, res) => {
    const stats = {};
    const userId = req.user.id;

    // Total attendance count
    db.get('SELECT COUNT(*) as total FROM attendance WHERE user_id = ?', [userId], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        stats.totalAttendance = result.total;

        // Present days this month
        db.get(`
      SELECT COUNT(*) as total FROM attendance 
      WHERE user_id = ? AND status = "present"
      AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    `, [userId], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            stats.presentThisMonth = result.total;

            // Total leave requests
            db.get('SELECT COUNT(*) as total FROM leaves WHERE user_id = ?', [userId], (err, result) => {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });
                stats.totalLeaves = result.total;

                // Pending leave requests
                db.get('SELECT COUNT(*) as total FROM leaves WHERE user_id = ? AND status = "pending"', [userId], (err, result) => {
                    if (err) return res.status(500).json({ success: false, message: 'Database error' });
                    stats.pendingLeaves = result.total;

                    // Approved leaves
                    db.get('SELECT COUNT(*) as total FROM leaves WHERE user_id = ? AND status = "approved"', [userId], (err, result) => {
                        if (err) return res.status(500).json({ success: false, message: 'Database error' });
                        stats.approvedLeaves = result.total;

                        // Attendance today
                        db.get('SELECT * FROM attendance WHERE user_id = ? AND date = DATE("now")', [userId], (err, today) => {
                            if (err) return res.status(500).json({ success: false, message: 'Database error' });
                            stats.attendanceToday = today || null;

                            res.json({ success: true, stats });
                        });
                    });
                });
            });
        });
    });
});

// Get recent activities (Admin)
router.get('/admin/recent-activities', authenticateToken, isAdmin, (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    db.all(`
    SELECT 'attendance' as type, a.id, a.date as activity_date, a.status, 
           u.name as user_name, a.created_at
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    UNION ALL
    SELECT 'leave' as type, l.id, l.start_date as activity_date, l.status, 
           u.name as user_name, l.created_at
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    ORDER BY created_at DESC
    LIMIT ?
  `, [limit], (err, activities) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, activities });
    });
});

module.exports = router;
