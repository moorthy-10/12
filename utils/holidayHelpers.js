const db = require('../config/database');

// Check if a specific date is a holiday
const isHolidayDate = (date, callback) => {
    db.get(`
    SELECT * FROM calendar_events
    WHERE is_holiday = 1
      AND start_date <= ?
      AND end_date >= ?
    LIMIT 1
  `, [date, date], (err, holiday) => {
        if (err) {
            return callback(err, null);
        }
        callback(null, holiday);
    });
};

// Auto-mark attendance as holiday for a user
const autoMarkHoliday = (user_id, date, holidayTitle, callback) => {
    db.run(`
    INSERT INTO attendance (user_id, date, status, notes)
    VALUES (?, ?, 'leave', ?)
  `, [user_id, date, `Holiday: ${holidayTitle}`], function (err) {
        if (err) {
            return callback(err, null);
        }

        db.get(`
      SELECT a.*, u.name as user_name, u.email, u.department
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `, [this.lastID], (err, record) => {
            callback(err, record);
        });
    });
};

// Check if user already has attendance for a date
const hasAttendanceForDate = (user_id, date, callback) => {
    db.get('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [user_id, date], callback);
};

module.exports = {
    isHolidayDate,
    autoMarkHoliday,
    hasAttendanceForDate
};
