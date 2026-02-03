const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { isHolidayDate, autoMarkHoliday, hasAttendanceForDate } = require('../utils/holidayHelpers');

// Get attendance records
router.get('/', authenticateToken, (req, res) => {
    const { user_id, start_date, end_date, status } = req.query;

    let query = `
    SELECT a.*, u.name as user_name, u.email, u.department
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
    const params = [];

    // If employee, only show their own records
    if (req.user.role === 'employee') {
        query += ' AND a.user_id = ?';
        params.push(req.user.id);
    } else if (user_id) {
        query += ' AND a.user_id = ?';
        params.push(user_id);
    }

    if (start_date) {
        query += ' AND a.date >= ?';
        params.push(start_date);
    }

    if (end_date) {
        query += ' AND a.date <= ?';
        params.push(end_date);
    }

    if (status) {
        query += ' AND a.status = ?';
        params.push(status);
    }

    query += ' ORDER BY a.date DESC, a.created_at DESC';

    db.all(query, params, (err, records) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, records });
    });
});

// Get single attendance record
router.get('/:id', authenticateToken, (req, res) => {
    db.get(`
    SELECT a.*, u.name as user_name, u.email, u.department
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = ?
  `, [req.params.id], (err, record) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (!record) {
            return res.status(404).json({ success: false, message: 'Attendance record not found' });
        }

        // Employees can only view their own records
        if (req.user.role === 'employee' && record.user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, record });
    });
});

// Mark attendance (Employees can mark their own, Admin can mark anyone's)
router.post('/', authenticateToken, [
    body('date').isDate(),
    body('status').isIn(['present', 'absent', 'half-day', 'leave']),
    body('user_id').optional().isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    let { user_id, date, status, check_in_time, check_out_time, notes } = req.body;

    // If employee, they can only mark their own attendance
    if (req.user.role === 'employee') {
        user_id = req.user.id;
    } else if (!user_id) {
        return res.status(400).json({ success: false, message: 'user_id is required for admin' });
    }

    // Check if attendance already exists for this date
    db.get('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [user_id, date], (err, existing) => {
        if (existing) {
            return res.status(400).json({ success: false, message: 'Attendance already marked for this date' });
        }

        db.run(`
      INSERT INTO attendance (user_id, date, status, check_in_time, check_out_time, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user_id, date, status, check_in_time, check_out_time, notes], function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to mark attendance' });
            }

            db.get(`
        SELECT a.*, u.name as user_name, u.email, u.department
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.id = ?
      `, [this.lastID], (err, record) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Attendance marked but failed to fetch' });
                }
                res.status(201).json({ success: true, message: 'Attendance marked successfully', record });
            });
        });
    });
});

// Update attendance (Admin only or own record if not yet finalized)
router.put('/:id', authenticateToken, [
    body('status').optional().isIn(['present', 'absent', 'half-day', 'leave'])
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { status, check_in_time, check_out_time, notes } = req.body;

    // First check if record exists and if user has permission
    db.get('SELECT * FROM attendance WHERE id = ?', [req.params.id], (err, record) => {
        if (err || !record) {
            return res.status(404).json({ success: false, message: 'Attendance record not found' });
        }

        // Only admin or the owner can update
        if (req.user.role !== 'admin' && record.user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const updates = [];
        const params = [];

        if (status) { updates.push('status = ?'); params.push(status); }
        if (check_in_time !== undefined) { updates.push('check_in_time = ?'); params.push(check_in_time); }
        if (check_out_time !== undefined) { updates.push('check_out_time = ?'); params.push(check_out_time); }
        if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        params.push(req.params.id);
        const query = `UPDATE attendance SET ${updates.join(', ')} WHERE id = ?`;

        db.run(query, params, function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to update attendance' });
            }

            db.get(`
        SELECT a.*, u.name as user_name, u.email, u.department
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.id = ?
      `, [req.params.id], (err, record) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Attendance updated but failed to fetch' });
                }
                res.json({ success: true, message: 'Attendance updated successfully', record });
            });
        });
    });
});

// Delete attendance (Admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM attendance WHERE id = ?', [req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to delete attendance record' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Attendance record not found' });
        }

        res.json({ success: true, message: 'Attendance record deleted successfully' });
    });
});
