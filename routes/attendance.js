'use strict';

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// ── Helper: format attendance record for response ─────────────────────────────
async function populate(rec) {
    await rec.populate('user', 'name email department');
    const obj = rec.toJSON();
    obj.user_id = obj.user.id || obj.user;
    obj.user_name = obj.user.name;
    obj.email = obj.user.email;
    obj.department = obj.user.department;
    return obj;
}

// ── GET /api/attendance ────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { user_id, start_date, end_date, status } = req.query;
        const filter = {};

        if (req.user.role === 'employee') {
            filter.user = req.user.id;
        } else if (user_id) {
            filter.user = user_id;
        }

        if (start_date) filter.date = { ...filter.date, $gte: start_date };
        if (end_date) filter.date = { ...filter.date, $lte: end_date };
        if (status) filter.status = status;

        const recs = await Attendance.find(filter)
            .populate('user', 'name email department')
            .sort({ date: -1, createdAt: -1 });

        const records = recs.map(r => {
            const obj = r.toJSON();
            obj.user_id = r.user._id.toString();
            obj.user_name = r.user.name;
            obj.email = r.user.email;
            obj.department = r.user.department;
            return obj;
        });

        res.json({ success: true, records });
    } catch (error) {
        console.error('GET /attendance error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/attendance/today ─────────────────────────────────────────────────
// NOTE: must be before /:id to avoid 'today' being treated as an id
router.get('/today', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const rec = await Attendance.findOne({ user: req.user.id, date: today })
            .populate('user', 'name email department');

        let record = null;
        if (rec) {
            record = rec.toJSON();
            record.user_id = rec.user._id.toString();
            record.user_name = rec.user.name;
            record.email = rec.user.email;
            record.department = rec.user.department;
        }

        res.json({
            success: true,
            record,
            hasClockedIn: !!record,
            canClockOut: record && record.check_in_time && !record.check_out_time
        });
    } catch (error) {
        console.error('GET /attendance/today error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/attendance/export/monthly ────────────────────────────────────────
// Admin only – returns an .xlsx file
router.get('/export/monthly', authenticateToken, isAdmin, async (req, res) => {
    try {
        const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();

        // Build YYYY-MM-DD range strings for the selected month
        const paddedMonth = String(month).padStart(2, '0');
        const startDate = `${year}-${paddedMonth}-01`;
        const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
        const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

        const records = await Attendance.find({
            date: { $gte: startDate, $lte: endDate }
        })
            .populate('user', 'name email department position')
            .sort({ date: 1 });

        // Build Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'GenLab HR System';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(`Attendance ${paddedMonth}-${year}`);

        // Header row
        sheet.columns = [
            { header: 'Employee Name', key: 'name', width: 24 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Department', key: 'department', width: 18 },
            { header: 'Position', key: 'position', width: 18 },
            { header: 'Date', key: 'date', width: 14 },
            { header: 'Clock In', key: 'clockIn', width: 12 },
            { header: 'Clock Out', key: 'clockOut', width: 12 },
            { header: 'Total Hours', key: 'totalHours', width: 14 },
            { header: 'Status', key: 'status', width: 12 },
        ];

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: 'FF1F3A5F' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 20;

        if (records.length === 0) {
            // Return empty sheet with headers only
        } else {
            records.forEach(r => {
                const user = r.user || {};

                // Prefer stored totalHours; fall back to string-based computation
                let totalHrsDisplay = r.totalHours != null
                    ? `${r.totalHours} hrs`
                    : (r.check_in_time && r.check_out_time
                        ? (() => {
                            const [ih, im] = r.check_in_time.split(':').map(Number);
                            const [oh, om] = r.check_out_time.split(':').map(Number);
                            const diff = (oh * 60 + om) - (ih * 60 + im);
                            if (diff < 0) return '-';
                            return `${(diff / 60).toFixed(2)} hrs`;
                        })()
                        : '-');

                sheet.addRow({
                    name: user.name || '-',
                    email: user.email || '-',
                    department: user.department || '-',
                    position: user.position || '-',
                    date: r.date,
                    clockIn: r.check_in_time || '-',
                    clockOut: r.check_out_time || '-',
                    totalHours: totalHrsDisplay,
                    status: r.status,
                });
            });

            // Zebra striping on data rows
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const fill = rowNumber % 2 === 0
                    ? 'FFF0F4FA'
                    : 'FFFFFFFF';
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                });
            });
        }

        // Auto-filter
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: sheet.rowCount, column: sheet.columnCount }
        };

        // Stream the file back
        const filename = `attendance_${year}_${paddedMonth}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('GET /attendance/export/monthly error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate export' });
    }
});

// ── GET /api/attendance/:id ───────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const rec = await Attendance.findById(req.params.id)
            .populate('user', 'name email department');
        if (!rec) return res.status(404).json({ success: false, message: 'Attendance record not found' });

        if (req.user.role === 'employee' && rec.user._id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const record = rec.toJSON();
        record.user_id = rec.user._id.toString();
        record.user_name = rec.user.name;
        record.email = rec.user.email;
        record.department = rec.user.department;

        res.json({ success: true, record });
    } catch (error) {
        console.error('GET /attendance/:id error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── POST /api/attendance ───────────────────────────────────────────────────────
router.post('/', authenticateToken, [
    body('date').isDate(),
    body('status').isIn(['present', 'absent', 'half-day', 'leave']),
    body('user_id').optional().isString()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    let { user_id, date, status, check_in_time, check_out_time, notes } = req.body;

    if (req.user.role === 'employee') {
        user_id = req.user.id;
    } else if (!user_id) {
        return res.status(400).json({ success: false, message: 'user_id is required for admin' });
    }

    try {
        const existing = await Attendance.findOne({ user: user_id, date });
        if (existing) return res.status(400).json({ success: false, message: 'Attendance already marked for this date' });

        const created = await Attendance.create({ user: user_id, date, status, check_in_time, check_out_time, notes });
        const rec = await Attendance.findById(created._id).populate('user', 'name email department');

        const record = rec.toJSON();
        record.user_id = rec.user._id.toString();
        record.user_name = rec.user.name;
        record.email = rec.user.email;
        record.department = rec.user.department;

        res.status(201).json({ success: true, message: 'Attendance marked successfully', record });
    } catch (error) {
        console.error('POST /attendance error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark attendance' });
    }
});

// ── PUT /api/attendance/:id ────────────────────────────────────────────────────
router.put('/:id', authenticateToken, [
    body('status').optional().isIn(['present', 'absent', 'half-day', 'leave'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const existing = await Attendance.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Attendance record not found' });

        if (req.user.role !== 'admin' && existing.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { status, check_in_time, check_out_time, notes } = req.body;
        const updates = {};
        if (status !== undefined) updates.status = status;
        if (check_in_time !== undefined) updates.check_in_time = check_in_time;
        if (check_out_time !== undefined) updates.check_out_time = check_out_time;
        if (notes !== undefined) updates.notes = notes;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const rec = await Attendance.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true })
            .populate('user', 'name email department');

        const record = rec.toJSON();
        record.user_id = rec.user._id.toString();
        record.user_name = rec.user.name;
        record.email = rec.user.email;
        record.department = rec.user.department;

        res.json({ success: true, message: 'Attendance updated successfully', record });
    } catch (error) {
        console.error('PUT /attendance/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to update attendance' });
    }
});

// ── DELETE /api/attendance/:id ─────────────────────────────────────────────────
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await Attendance.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Attendance record not found' });
        res.json({ success: true, message: 'Attendance record deleted successfully' });
    } catch (error) {
        console.error('DELETE /attendance error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete attendance record' });
    }
});

// ── POST /api/attendance/clock-in ──────────────────────────────────────────────
router.post('/clock-in', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC

    try {
        // Check if today is a holiday
        const holiday = await CalendarEvent.findOne({
            is_holiday: true,
            start_date: { $lte: today },
            end_date: { $gte: today }
        });

        if (holiday) {
            const existing = await Attendance.findOne({ user: user_id, date: today });
            if (existing) {
                const record = existing.toJSON();
                return res.status(400).json({
                    success: false,
                    message: `Today is a holiday: ${holiday.title}. Attendance already marked.`,
                    isHoliday: true,
                    holiday: { title: holiday.title },
                    record
                });
            }

            // Auto-mark as holiday leave
            const created = await Attendance.create({
                user: user_id, date: today, status: 'leave',
                notes: `Holiday: ${holiday.title}`
            });
            const rec = await Attendance.findById(created._id).populate('user', 'name email department');
            const record = rec.toJSON();
            record.user_id = rec.user._id.toString();
            record.user_name = rec.user.name;

            return res.status(201).json({
                success: false,
                message: `Today is a holiday: ${holiday.title}. Clock-in is disabled. Attendance auto-marked.`,
                isHoliday: true,
                holiday: { title: holiday.title },
                record
            });
        }

        // ── Guard: Prevent double clock-in ────────────────────────────────────
        const existing = await Attendance.findOne({ user: user_id, date: today });
        if (existing && existing.check_in_time) {
            return res.status(400).json({
                success: false,
                message: 'You have already clocked in today',
                record: existing.toJSON()
            });
        }

        // ── Create clock-in record ─────────────────────────────────────────────
        const now = new Date(); // UTC
        const check_in_time = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

        const created = await Attendance.create({
            user: user_id,
            date: today,
            status: 'present',
            check_in_time,
            clockIn: now // store full UTC Date for accurate totalHours calculation
        });
        const rec = await Attendance.findById(created._id).populate('user', 'name email department');
        const record = rec.toJSON();
        record.user_id = rec.user._id.toString();
        record.user_name = rec.user.name;
        record.email = rec.user.email;
        record.department = rec.user.department;

        res.status(201).json({ success: true, message: `Clocked in successfully at ${check_in_time} UTC`, record });
    } catch (error) {
        console.error('Clock-in error:', error);
        res.status(500).json({ success: false, message: 'Failed to clock in' });
    }
});

// ── POST /api/attendance/clock-out ─────────────────────────────────────────────
router.post('/clock-out', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC

    try {
        const existing = await Attendance.findOne({ user: user_id, date: today });

        // ── Guard: No record at all ───────────────────────────────────────────
        if (!existing) {
            return res.status(400).json({ success: false, message: 'You must clock in before clocking out' });
        }

        // ── Guard: No clock-in time ───────────────────────────────────────────
        if (!existing.check_in_time) {
            return res.status(400).json({ success: false, message: 'No clock-in time found for today. Please clock in first.' });
        }

        // ── Guard: Already clocked out ────────────────────────────────────────
        if (existing.check_out_time) {
            return res.status(400).json({
                success: false,
                message: 'You have already clocked out today',
                record: existing.toJSON()
            });
        }

        // ── Calculate totalHours ──────────────────────────────────────────────
        const now = new Date(); // UTC
        const check_out_time = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

        let totalHours = null;
        if (existing.clockIn) {
            // Precise: use stored UTC Date objects
            totalHours = parseFloat(((now - existing.clockIn) / (1000 * 60 * 60)).toFixed(2));
        } else {
            // Fallback: derive from HH:MM strings
            const [ih, im] = existing.check_in_time.split(':').map(Number);
            const [oh, om] = check_out_time.split(':').map(Number);
            const diffMins = (oh * 60 + om) - (ih * 60 + im);
            if (diffMins > 0) {
                totalHours = parseFloat((diffMins / 60).toFixed(2));
            }
        }

        const rec = await Attendance.findByIdAndUpdate(
            existing._id,
            { $set: { check_out_time, clockOut: now, totalHours } },
            { new: true }
        ).populate('user', 'name email department');

        const record = rec.toJSON();
        record.user_id = rec.user._id.toString();
        record.user_name = rec.user.name;
        record.email = rec.user.email;
        record.department = rec.user.department;

        res.json({
            success: true,
            message: `Clocked out successfully at ${check_out_time} UTC. Total hours: ${totalHours ?? '-'}`,
            record
        });
    } catch (error) {
        console.error('Clock-out error:', error);
        res.status(500).json({ success: false, message: 'Failed to clock out' });
    }
});

module.exports = router;
