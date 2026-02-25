'use strict';

const Notification = require('../models/Notification');
const { sendPushNotification } = require('../services/pushService');

/**
 * Create a notification record and emit it in real-time via Socket.IO.
 * All errors are caught internally — no existing route can break.
 *
 * @param {object} io  - Socket.IO server instance (may be null)
 * @param {object} opts
 * @param {string} opts.userId    - Target user's MongoDB ID string
 * @param {string} opts.type      - 'chat' | 'task' | 'leave' | 'attendance'
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.relatedId]
 */
async function notify(io, { userId, type, title, message, relatedId }) {
    try {
        const doc = await Notification.create({
            user: userId,
            type,
            title,
            message,
            related_id: relatedId || null,
        });

        if (io) {
            const payload = {
                id: doc._id.toString(),
                user_id: userId,
                type: doc.type,
                title: doc.title,
                message: doc.message,
                related_id: relatedId || null,
                is_read: 0,
                createdAt: doc.createdAt,
            };
            io.to(`user:${userId}`).emit('new-notification', payload);
        }

        // ── PUSH NOTIFICATION (Extension) ──
        // Only trigger pushes for the approved production list
        const pushSupportedTypes = ['task', 'leave', 'calendar', 'standup', 'chat'];
        if (pushSupportedTypes.includes(type)) {
            // Asynchronous, non-blocking
            sendPushNotification(userId, title, message, {
                type: type,
                relatedId: relatedId || ''
            });
        }
    } catch (err) {
        // Non-fatal — never crash the calling route
        console.error('notify() error (non-fatal):', err.message);
    }
}

module.exports = notify;
