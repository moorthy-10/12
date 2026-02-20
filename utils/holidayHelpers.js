'use strict';

const CalendarEvent = require('../models/CalendarEvent');
const Attendance = require('../models/Attendance');

/**
 * Check if a specific date (YYYY-MM-DD) is a holiday.
 * Async/await version for routes; callback form kept for backward compat.
 */
const isHolidayDate = async (date) => {
    return CalendarEvent.findOne({
        is_holiday: true,
        start_date: { $lte: date },
        end_date: { $gte: date }
    });
};

/**
 * Auto-mark attendance as holiday for a user.
 * Returns the created + populated attendance doc.
 */
const autoMarkHoliday = async (user_id, date, holidayTitle) => {
    const created = await Attendance.create({
        user: user_id,
        date,
        status: 'leave',
        notes: `Holiday: ${holidayTitle}`
    });
    return Attendance.findById(created._id).populate('user', 'name email department');
};

/**
 * Check if user already has attendance for a date.
 */
const hasAttendanceForDate = (user_id, date) => {
    return Attendance.findOne({ user: user_id, date });
};

module.exports = { isHolidayDate, autoMarkHoliday, hasAttendanceForDate };
