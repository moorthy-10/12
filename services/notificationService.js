'use strict';

const admin = require('../config/firebase');
const User = require('../models/User');
const Notification = require('../models/Notification');
const groupPushCooldowns = new Map();

/**
 * Sends a push notification to a single user.
 * 
 * @param {string} userId - The unique ID of the user.
 * @param {string} title - Title of the notification.
 * @param {string} body - Body content of the notification.
 * @param {Object} data - Additional metadata (must be strings).
 */
async function sendPushToUser(userId, title, body, data = {}) {
    try {
        const user = await User.findById(userId).select('fcmToken');

        if (!user || !user.fcmToken) {
            return;
        }

        const message = {
            notification: { title, body },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK', // Ensure mobile app handling
            },
            token: user.fcmToken
        };

        try {
            await admin.messaging().send(message);
            console.log(`[PushSent] userId=${userId} type=${data.type || 'unknown'}`);
        } catch (error) {
            console.error(`[PushFail] userId=${userId} errorCode=${error.code || 'unknown'}`);
            console.error(`[NotificationService] FCM error for user ${userId}:`, error.message);

            // Clean up invalid tokens
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                await User.findByIdAndUpdate(userId, { fcmToken: null });
            }
        }
    } catch (error) {
        console.error(`[NotificationService] Error in sendPushToUser:`, error);
    }
}

/**
 * Sends a push notification to multiple users.
 * 
 * @param {string[]} userIds - Array of user IDs.
 * @param {string} title - Title of the notification.
 * @param {string} body - Body content of the notification.
 * @param {Object} data - Additional metadata (must be strings).
 */
async function sendPushToMultipleUsers(userIds, title, body, data = {}) {
    if (!userIds || userIds.length === 0) return;

    try {
        const users = await User.find({ _id: { $in: userIds }, fcmToken: { $ne: null } }).select('fcmToken');
        const tokens = users.map(u => u.fcmToken);

        if (tokens.length === 0) return;

        const message = {
            notification: { title, body },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
            tokens: tokens
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`[PushMulticastSent] successCount=${response.successCount} failureCount=${response.failureCount} type=${data.type || 'unknown'}`);
        } catch (error) {
            console.error(`[PushFail] userId=multiple errorCode=${error.code || 'unknown'}`);
            console.error(`[NotificationService] FCM Multicast error:`, error.message);
        }
    } catch (error) {
        console.error(`[NotificationService] Error in sendPushToMultipleUsers:`, error);
    }
}

/**
 * Saves a notification to the database.
 * 
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.type
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.relatedId]
 * @param {string} [opts.relatedModel]
 * @param {string} [opts.priority]
 */
async function saveNotification({ userId, type, title, message, relatedId, relatedModel, priority }) {
    try {
        const doc = await Notification.create({
            user: userId,
            type,
            title,
            message,
            related_id: relatedId || null,
            related_model: relatedModel || null,
            priority: priority || 'normal',
            is_read: false,
            read_at: null
        });

        // ── Real-Time Notification Emit (Non-Blocking) ────────────────────────
        try {
            const io = global.io;
            if (io && userId) {
                io.to(userId.toString()).emit("NEW_NOTIFICATION", {
                    type,
                    title,
                    message,
                    related_id: relatedId || null
                });
            }
        } catch (socketErr) {
            console.error(`[NotificationService] Socket emit error:`, socketErr.message);
        }

        return doc;
    } catch (error) {
        console.error(`[NotificationService] Error saving notification to DB:`, error.message);
        // Never block execution if DB write fails
        return null;
    }
}


/**
 * Sends a push notification to group members with spam protection.
 * 
 * @param {string} groupId 
 * @param {string[]} userIds 
 * @param {string} title 
 * @param {string} body 
 * @param {Object} data 
 */
async function sendPushToGroup(groupId, userIds, title, body, data = {}) {
    try {
        const now = Date.now();
        const last = groupPushCooldowns.get(groupId.toString());
        if (last && (now - last) < 10000) {
            // console.log(`[PushSpam] Cooldown active for group: ${groupId}`);
            return;
        }

        groupPushCooldowns.set(groupId.toString(), now);
        return await sendPushToMultipleUsers(userIds, title, body, data);
    } catch (error) {
        console.error(`[NotificationService] Error in sendPushToGroup:`, error);
    }
}


module.exports = {
    sendPushToUser,
    sendPushToMultipleUsers,
    sendPushToGroup,
    saveNotification
};
