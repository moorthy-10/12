const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const dbAll = (sql, params) =>
    new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    );

const dbRun = (sql, params) =>
    new Promise((resolve, reject) =>
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        })
    );

// ── GET /api/notifications ─────────────────────────────────────────────────
// Returns the calling user's notifications, newest first.
// Supports ?unread=true to filter to unread only.
router.get('/', authenticateToken, async (req, res) => {
    try {
        const unreadOnly = req.query.unread === 'true';
        let sql = `
            SELECT * FROM notifications
            WHERE user_id = ?
            ${unreadOnly ? 'AND is_read = 0' : ''}
            ORDER BY created_at DESC
            LIMIT 60
        `;
        const notifications = await dbAll(sql, [req.user.id]);
        const unreadCount = notifications.filter(n => !n.is_read).length;
        res.json({ success: true, notifications, unreadCount });
    } catch (err) {
        console.error('GET /api/notifications error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── PUT /api/notifications/:id/read ───────────────────────────────────────
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const { changes } = await dbRun(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (changes === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        res.json({ success: true, message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── PUT /api/notifications/read-all ───────────────────────────────────────
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        await dbRun(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
            [req.user.id]
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── DELETE /api/notifications/:id ─────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await dbRun(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
