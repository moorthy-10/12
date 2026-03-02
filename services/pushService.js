'use strict';

const admin = require('../config/firebase');
const User = require('../models/User');

/**
 * Sends a push notification to a specific user.
 * 
 * @param {string} userId - The ID of the user to send the notification to.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body message of the notification.
 * @param {Object} data - Additional data for the notification (deep linking).
 * @param {string} data.type - The type of notification (task, leave, calendar, standup, chat).
 * @param {string} data.relatedId - The ID of the related object.
 */
async function sendPushNotification(userId, title, body, data = {}) {
    try {
        const user = await User.findById(userId).select('fcmToken');

        if (!user || !user.fcmToken) {
            return;
        }

        // Determine channel and sound based on notification type
        const isCall = data.type === 'CALL_RINGING';
        const channelId = isCall ? 'genlab_calls' : 'genlab_notifications';
        const soundName = isCall ? 'call_ringtone' : 'notification_sound';

        const message = {
            notification: {
                title: title,
                body: body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK' // For mobile app handlers
            },
            android: {
                priority: isCall ? 'high' : 'normal',
                notification: {
                    channelId: channelId,
                    sound: soundName,
                    priority: isCall ? 'high' : 'default'
                }
            },
            token: user.fcmToken
        };

        try {
            await admin.messaging().send(message);
            console.log(`✅ Push notification sent to user ${userId} (Type: ${data.type || 'default'})`);
        } catch (error) {
            console.error(`❌ Push notification failed for user ${userId}:`, error.message);

            // If the token is invalid or no longer registered, remove it from the user record
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                console.log(`🗑️ Removing invalid FCM token for user ${userId}`);
                await User.findByIdAndUpdate(userId, { fcmToken: null });
            }
        }
    } catch (error) {
        // Log error but don't crash server or block logic
        console.error('❌ Error in sendPushNotification service:', error);
    }
}

module.exports = {
    sendPushNotification
};
