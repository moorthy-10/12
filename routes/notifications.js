'use strict';

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { body: bodyV } = require('express-validator');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const filter = { user: req.user.id };
        if (req.query.unread === 'true') filter.is_read = false;

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({ user: req.user.id, is_read: false });

        res.json({
            success: true,
            notifications: notifications.map(n => {
                const obj = n.toJSON();
                // Legacy field aliases used by the frontend
                obj.user_id = req.user.id;
                obj.is_read = n.is_read ? 1 : 0;
                return obj;
            }),
            unreadCount
        });
    } catch (error) {
        console.error('GET /notifications error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── PUT /api/notifications/:id/read ──────────────────────────────────────────
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const notif = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { $set: { is_read: true } },
            { new: true }
        );
        if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('PUT /notifications/:id/read error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── PUT /api/notifications/read-all ──────────────────────────────────────────
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user.id, is_read: false }, { $set: { is_read: true } });
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('PUT /notifications/read-all error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── DELETE /api/notifications/:id ─────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!result) return res.status(404).json({ success: false, message: 'Notification not found' });
        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('DELETE /notifications/:id error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
