'use strict';

const attendanceService = require('../services/attendanceService');
const { validationResult } = require('express-validator');

/**
 * POST /api/attendance/admin
 */
async function adminOverride(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { user_id, date, status, check_in, check_out, reason } = req.body;

        // Validation check for check_in < check_out if both are provided
        if (check_in && check_out) {
            const cin = new Date(check_in);
            const cout = new Date(check_out);
            if (cin >= cout) {
                return res.status(400).json({ success: false, message: 'Check-in must be before check-out' });
            }
        }

        const d = new Date(date);
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        if (d > today) {
            return res.status(400).json({ success: false, message: 'Future dates are not allowed' });
        }
        if (d < thirtyDaysAgo) {
            return res.status(400).json({ success: false, message: 'Edits older than 30 days are restricted' });
        }

        await attendanceService.adminOverrideAttendance({
            adminId: req.user.id,
            user_id,
            date,
            status,
            check_in,
            check_out,
            reason
        });

        res.status(200).json({ success: true, message: 'Attendance updated successfully' });
    } catch (error) {
        console.error('[AdminAttendance] Override error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
}

/**
 * GET /api/attendance/report
 */
async function getReport(req, res) {
    const { start, end, export: exportFlag, department } = req.query;

    if (!start || !end) {
        return res.status(400).json({ success: false, message: 'Start and end dates are required (YYYY-MM-DD)' });
    }

    try {
        const result = await attendanceService.generateAttendanceReport({
            start,
            end,
            userObj: req.user,
            department: department || req.user.department_ref || req.user.department,
            exportMode: exportFlag === 'true',
            res
        });

        if (exportFlag !== 'true') {
            res.json({ success: true, records: result });
        }
    } catch (error) {
        console.error('[AttendanceReport] Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message || 'Server error' });
        }
    }
}

module.exports = {
    adminOverride,
    getReport
};
