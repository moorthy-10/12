'use strict';

/**
 * standupCron.js
 * Runs every day at 10:00 AM IST.
 * Generates a summary of today's standups and sends a notification to all admins.
 * Does NOT send duplicate summaries (tracked in memory per-process per-day).
 */

const cron = require('node-cron');
const Standup = require('../models/Standup');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPushNotification } = require('../services/pushService');

// Memory guard: set of date strings already notified this process lifecycle
const notifiedDates = new Set();

function todayIST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'YYYY-MM-DD'
}

async function sendStandupSummary() {
    const date = todayIST();

    // Duplicate guard
    if (notifiedDates.has(date)) {
        console.log(`[StandupCron] Summary for ${date} already sent — skipping.`);
        return;
    }

    try {
        const standups = await Standup.find({ date }).lean();
        const totalEmployees = await User.countDocuments({ role: 'employee', status: 'active' });
        const submittedCount = standups.length;
        const missingCount = Math.max(0, totalEmployees - submittedCount);
        const totalBlockers = standups.filter(s => s.blockers && s.blockers.trim()).length;
        const highWorkload = standups.filter(s =>
            s.todayTasks.reduce((sum, t) => sum + t.estimatedHours, 0) > 8
        ).length;

        const title = 'Daily Standup Summary';
        const message = `${submittedCount}/${totalEmployees} submitted. ${missingCount} pending. ${totalBlockers} blocker${totalBlockers !== 1 ? 's' : ''} reported.`;

        // Fetch all admin users
        const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();

        if (admins.length === 0) {
            console.warn('[StandupCron] No admin users found — summary not sent.');
            return;
        }

        const notifications = admins.map(admin => ({
            user: admin._id,
            type: 'task',          // reuse existing enum value
            title,
            message,
            related_id: null,
            is_read: false
        }));

        await Notification.insertMany(notifications, { ordered: false });

        notifiedDates.add(date);

        console.log(`[StandupCron] Summary sent to ${admins.length} admin(s): "${message}"`);
        console.log(`[StandupCron] High-workload employees today: ${highWorkload}`);
    } catch (err) {
        console.error('[StandupCron] Error generating summary:', err);
    }
}

async function sendRemindersToMissing() {
    const date = todayIST();
    try {
        const totalEmployees = await User.find({ role: 'employee', status: 'active' }).select('_id name').lean();
        const submittedUserIds = await Standup.find({ date }).distinct('userId');
        const missingEmployees = totalEmployees.filter(emp => !submittedUserIds.map(id => id.toString()).includes(emp._id.toString()));

        if (missingEmployees.length === 0) {
            console.log(`[StandupCron] All employees submitted standups for ${date}. No reminders needed.`);
            return { success: true, count: 0 };
        }

        const notifications = missingEmployees.map(emp => ({
            user: emp._id,
            type: 'task',
            title: '⏰ Standup Reminder',
            message: `Hi ${emp.name.split(' ')[0]}, you haven't submitted your daily standup yet. Please do it soon!`,
            is_read: false
        }));

        await Notification.insertMany(notifications, { ordered: false });

        // Trigger push notification for each missing employee
        missingEmployees.forEach(emp => {
            sendPushNotification(
                emp._id.toString(),
                'Standup Reminder',
                'You have not submitted your daily standup yet.',
                { type: 'standup' }
            );
        });

        console.log(`[StandupCron] Sent reminders to ${missingEmployees.length} employee(s).`);
        return { success: true, count: missingEmployees.length };
    } catch (err) {
        console.error('[StandupCron] Error sending reminders:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Register the cron schedule.
 * Called once from server.js after DB is connected.
 */
function initStandupCron() {
    // '0 10 * * *' = every day at 10:00 AM — Admin Summary
    cron.schedule('0 10 * * *', sendStandupSummary, {
        timezone: 'Asia/Kolkata',
        name: 'standupDailySummary'
    });

    // '0 11 * * *' = every day at 11:00 AM — 1st Reminder
    cron.schedule('0 11 * * *', sendRemindersToMissing, {
        timezone: 'Asia/Kolkata',
        name: 'standupReminder11AM'
    });

    // '0 17 * * *' = every day at 5:00 PM — Final Reminder
    cron.schedule('0 17 * * *', sendRemindersToMissing, {
        timezone: 'Asia/Kolkata',
        name: 'standupReminder5PM'
    });

    console.log('[StandupCron] Cron jobs scheduled: 10AM (Summary), 11AM (Reminder), 5PM (Final Reminder) IST.');
}

module.exports = { initStandupCron, sendStandupSummary, sendRemindersToMissing };
