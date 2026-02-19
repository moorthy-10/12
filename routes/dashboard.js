const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Helper: wrap db.get in a Promise
const dbGet = (sql, params) =>
    new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
    );

// Get dashboard statistics (Admin) — parallel queries for speed
router.get('/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [
            totalUsersRow,
            activeUsersRow,
            todayAttendanceRow,
            presentTodayRow,
            pendingLeavesRow,
            approvedLeavesMonthRow
        ] = await Promise.all([
            dbGet('SELECT COUNT(*) as total FROM users', []),
            dbGet('SELECT COUNT(*) as total FROM users WHERE status = "active"', []),
            dbGet('SELECT COUNT(*) as total FROM attendance WHERE date = DATE("now")', []),
            dbGet('SELECT COUNT(*) as total FROM attendance WHERE date = DATE("now") AND status = "present"', []),
            dbGet('SELECT COUNT(*) as total FROM leaves WHERE status = "pending"', []),
            dbGet(`SELECT COUNT(*) as total FROM leaves WHERE status = "approved" AND strftime('%Y-%m', start_date) = strftime('%Y-%m', 'now')`, [])
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers: totalUsersRow.total,
                activeUsers: activeUsersRow.total,
                todayAttendance: todayAttendanceRow.total,
                presentToday: presentTodayRow.total,
                pendingLeaves: pendingLeavesRow.total,
                approvedLeavesThisMonth: approvedLeavesMonthRow.total
            }
        });
    } catch (err) {
        console.error('Dashboard admin stats error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Get dashboard statistics (Employee) — parallel queries for speed
router.get('/employee/stats', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const [
            totalAttRow,
            presentMonthRow,
            totalLeavesRow,
            pendingLeavesRow,
            approvedLeavesRow,
            todayRow
        ] = await Promise.all([
            dbGet('SELECT COUNT(*) as total FROM attendance WHERE user_id = ?', [userId]),
            dbGet(`SELECT COUNT(*) as total FROM attendance WHERE user_id = ? AND status = "present" AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')`, [userId]),
            dbGet('SELECT COUNT(*) as total FROM leaves WHERE user_id = ?', [userId]),
            dbGet('SELECT COUNT(*) as total FROM leaves WHERE user_id = ? AND status = "pending"', [userId]),
            dbGet('SELECT COUNT(*) as total FROM leaves WHERE user_id = ? AND status = "approved"', [userId]),
            dbGet('SELECT * FROM attendance WHERE user_id = ? AND date = DATE("now")', [userId])
        ]);

        res.json({
            success: true,
            stats: {
                totalAttendance: totalAttRow.total,
                presentThisMonth: presentMonthRow.total,
                totalLeaves: totalLeavesRow.total,
                pendingLeaves: pendingLeavesRow.total,
                approvedLeaves: approvedLeavesRow.total,
                attendanceToday: todayRow || null
            }
        });
    } catch (err) {
        console.error('Dashboard employee stats error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Get recent activities (Admin)
// FIX: SQLite UNION ALL ORDER BY must reference the column alias from the first SELECT,
// not a table-qualified name. Wrapped with a subquery to make column reference unambiguous.
router.get('/admin/recent-activities', authenticateToken, isAdmin, (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    db.all(`
    SELECT * FROM (
      SELECT 'attendance' as type, a.id, a.date as activity_date, a.status,
             u.name as user_name, a.created_at
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      UNION ALL
      SELECT 'leave' as type, l.id, l.start_date as activity_date, l.status,
             u.name as user_name, l.created_at
      FROM leaves l
      JOIN users u ON l.user_id = u.id
    ) ORDER BY created_at DESC
    LIMIT ?
  `, [limit], (err, activities) => {
        if (err) {
            console.error('Recent activities query error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, activities });
    });
});

module.exports = router;
