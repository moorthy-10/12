/**
 * notify.js — Shared notification helper
 *
 * Creates a notification row in the DB and immediately pushes it to the
 * target user's personal socket room (user:{userId}).
 *
 * Usage:
 *   const notify = require('../utils/notify');
 *   await notify(io, db, { userId, type, title, message, relatedId });
 *
 * This module is intentionally async-safe: any DB or socket error is caught
 * and logged but never propagates to the calling route, so existing routes
 * cannot be broken by a failed notification.
 */

'use strict';

const db = require('../config/database');

/**
 * @param {import('socket.io').Server} io
 * @param {{ userId: number, type: string, title: string, message: string, relatedId?: number }} opts
 */
async function notify(io, { userId, type, title, message, relatedId = null }) {
    try {
        // --- Validation --------------------------------------------------
        const VALID_TYPES = ['chat', 'task', 'leave', 'attendance'];
        if (!userId || !VALID_TYPES.includes(type) || !title || !message) {
            console.warn('[notify] Invalid params, skipping:', { userId, type, title });
            return null;
        }

        // --- Write to DB -------------------------------------------------
        const notification = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO notifications (user_id, type, title, message, related_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, type, title.slice(0, 200), message.slice(0, 500), relatedId],
                function (err) {
                    if (err) return reject(err);
                    db.get(
                        'SELECT * FROM notifications WHERE id = ?',
                        [this.lastID],
                        (err2, row) => (err2 ? reject(err2) : resolve(row))
                    );
                }
            );
        });

        // --- Real-time push ----------------------------------------------
        if (io) {
            io.to(`user:${userId}`).emit('new-notification', notification);
        }

        return notification;
    } catch (err) {
        console.error('[notify] Failed to create notification:', err.message);
        return null; // never throw — caller must not be affected
    }
}

module.exports = notify;
