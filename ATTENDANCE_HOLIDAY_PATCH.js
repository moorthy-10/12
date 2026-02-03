// Patch for attendance.js - Clock-in with holiday checking
// This code replaces the clock-in endpoint starting at line 198

const { isHolidayDate, autoMarkHoliday, hasAttendanceForDate } = require('../utils/holidayHelpers');

// Clock-in (Employees only, for today only)
router.post('/clock-in', authenticateToken, (req, res) => {
    const user_id = req.user.id; // Always for the logged-in user
    const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

    // First, check if today is a holiday
    isHolidayDate(today, (err, holiday) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error checking holiday' });
        }

        if (holiday) {
            // Today is a holiday - check if attendance already marked
            hasAttendanceForDate(user_id, today, (err, existing) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Database error' });
                }

                if (existing) {
                    return res.status(400).json({
                        success: false,
                        message: `Today is a holiday: ${holiday.title}. Attendance already marked.`,
                        isHoliday: true,
                        holiday: holiday,
                        record: existing
                    });
                }

                // Auto-mark attendance as holiday
                autoMarkHoliday(user_id, today, holiday.title, (err, record) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Failed to auto-mark holiday attendance' });
                    }

                    res.status(201).json({
                        success: false,
                        message: `Today is a holiday: ${holiday.title}. Clock-in is disabled. Attendance auto-marked.`,
                        isHoliday: true,
                        holiday: holiday,
                        record: record
                    });
                });
            });
            return; // Exit early - don't allow normal clock-in
        }

        // Not a holiday - proceed with normal clock-in
        // Check if already clocked in today
        hasAttendanceForDate(user_id, today, (err, existing) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'You have already clocked in today',
                    record: existing
                });
            }

            // Get current time in HH:MM format
            const now = new Date();
            const check_in_time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            // Create attendance record with clock-in
            db.run(`
        INSERT INTO attendance (user_id, date, status, check_in_time)
        VALUES (?, ?, 'present', ?)
      `, [user_id, today, check_in_time], function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Failed to clock in' });
                }

                db.get(`
          SELECT a.*, u.name as user_name, u.email, u.department
          FROM attendance a
          JOIN users u ON a.user_id = u.id
          WHERE a.id = ?
        `, [this.lastID], (err, record) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Clocked in but failed to fetch' });
                    }
                    res.status(201).json({
                        success: true,
                        message: `Clocked in successfully at ${check_in_time}`,
                        record
                    });
                });
            });
        });
    });
});
