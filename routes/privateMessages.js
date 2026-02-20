'use strict';

const express = require('express');
const router = express.Router();
const PrivateMessage = require('../models/PrivateMessage');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// ── GET /api/private-messages/:userId ────────────────────────────────────────
router.get('/:userId', authenticateToken, async (req, res) => {
    const myId = req.user.id;
    const otherId = req.params.userId;

    if (myId === otherId) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    try {
        const otherUser = await User.findById(otherId).select('id name email role');
        if (!otherUser) return res.status(404).json({ success: false, message: 'User not found' });

        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = parseInt(req.query.offset) || 0;

        const messages = await PrivateMessage.find({
            $or: [
                { sender: myId, receiver: otherId },
                { sender: otherId, receiver: myId }
            ]
        })
            .populate('sender', 'name email')
            .sort({ createdAt: 1 })
            .skip(offset)
            .limit(limit);

        const shaped = messages.map(m => {
            const obj = m.toJSON();
            obj.sender_id = m.sender._id.toString();
            obj.sender_name = m.sender.name;
            obj.sender_email = m.sender.email;
            obj.receiver_id = m.receiver.toString();
            return obj;
        });

        res.json({ success: true, messages: shaped, otherUser });
    } catch (error) {
        console.error('Get private messages error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
