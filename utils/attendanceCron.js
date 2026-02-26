'use strict';

const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { sendPushToMultipleUsers } = require('../services/notificationService');

/**
 * autoCloseAttendance
 * Logic: Find attendance records where:
 * date = today, clockIn exists, clockOut is null
 * Set clockOut = 23:59 of that day, calculate totalHours, set autoClosed = true
 */
async function autoCloseAttendance() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    console.log(`[AttendanceCron] Running auto-close for ${today}...`);

    try {
        const records = await Attendance.find({
            date: today,
            clockIn: { $ne: null },
            clockOut: null
        });

        if (records.length === 0) {
            console.log(`[AttendanceCron] No records to auto-close for ${today}.`);
            return;
        }

        const now = new Date(); // Approx 23:59:00 IST
        const check_out_time = "23:59";

        for (const record of records) {
            const clockIn = record.clockIn;
            let totalHours = 0;

            if (clockIn) {
                const diffMs = now - clockIn;
                totalHours = Math.max(0, parseFloat((diffMs / 3600000).toFixed(2)));
            }

            await Attendance.findByIdAndUpdate(record._id, {
                $set: {
                    check_out_time,
                    clockOut: now,
                    totalHours,
                    autoClosed: true
                }
            });
        }
        console.log(`[AttendanceCron] Successfully auto-closed ${records.length} records for ${today}.`);
    } catch (err) {
        console.error('[AttendanceCron] Error in auto-close attendance cron:', err);
    }
}

/**
 * sendAttendanceReminders
 * Logic: Every day at 9:30 AM IST, find users who have NOT clocked in today.
 * Send them a push notification.
 */
async function sendAttendanceReminders() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    console.log(`[AttendanceCron] Running attendance reminders for ${today}...`);

    try {
        // Get all active employees
        const employees = await User.find({ role: 'employee', status: 'active' }).select('_id');
        const employeeIds = employees.map(e => e._id.toString());

        // Get users who already clocked in today
        const attendanceRecords = await Attendance.find({ date: today }).distinct('user');
        const clockedInUserIds = attendanceRecords.map(id => id.toString());

        // Filter missing users
        const missingUserIds = employeeIds.filter(id => !clockedInUserIds.includes(id));

        if (missingUserIds.length > 0) {
            await sendPushToMultipleUsers(
                missingUserIds,
                'Attendance Reminder',
                'Please clock in for today',
                { type: 'ATTENDANCE_REMINDER' }
            );
            console.log(`[AttendanceCron] Sent attendance reminders to ${missingUserIds.length} users.`);
        } else {
            console.log(`[AttendanceCron] No attendance reminders needed today.`);
        }
    } catch (err) {
        console.error('[AttendanceCron] Error in sendAttendanceReminders:', err);
    }
}

function initAttendanceCron() {
    cron.schedule('59 23 * * *', autoCloseAttendance, {
        timezone: 'Asia/Kolkata',
        name: 'attendanceAutoClose'
    });

    // 9:30 AM daily in Asia/Kolkata
    cron.schedule('30 9 * * *', sendAttendanceReminders, {
        timezone: 'Asia/Kolkata',
        name: 'attendanceReminder930AM'
    });

    console.log('[AttendanceCron] Cron jobs scheduled: 9:30 AM (Reminders), 23:59 (Auto-close) IST.');
}

module.exports = { initAttendanceCron, autoCloseAttendance, sendAttendanceReminders };
