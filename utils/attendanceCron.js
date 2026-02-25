'use strict';

const cron = require('node-cron');
const Attendance = require('../models/Attendance');

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

function initAttendanceCron() {
    // 23:59 daily in Asia/Kolkata
    cron.schedule('59 23 * * *', autoCloseAttendance, {
        timezone: 'Asia/Kolkata',
        name: 'attendanceAutoClose'
    });

    console.log('[AttendanceCron] Attendance auto-close scheduled at 23:59 IST.');
}

module.exports = { initAttendanceCron, autoCloseAttendance };
