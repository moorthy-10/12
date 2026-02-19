const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const dbGet = (sql, params) =>
    new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
    );

const dbAll = (sql, params) =>
    new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    );

// GET /api/private-messages/:userId
// Returns conversation history between current user and target user
router.get('/:userId', authenticateToken, async (req, res) => {
    const myId = req.user.id;
    const otherId = parseInt(req.params.userId, 10);

    if (isNaN(otherId) || myId === otherId) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    try {
        // Verify the other user exists
        const otherUser = await dbGet('SELECT id, name, email, role FROM users WHERE id = ?', [otherId]);
        if (!otherUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = parseInt(req.query.offset) || 0;

        const messages = await dbAll(
            `SELECT m.*, u.name as sender_name, u.email as sender_email
             FROM private_messages m
             JOIN users u ON m.sender_id = u.id
             WHERE (m.sender_id = ? AND m.receiver_id = ?)
                OR (m.sender_id = ? AND m.receiver_id = ?)
             ORDER BY m.created_at ASC
             LIMIT ? OFFSET ?`,
            [myId, otherId, otherId, myId, limit, offset]
        );

        res.json({ success: true, messages, otherUser });
    } catch (err) {
        console.error('Get private messages error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
