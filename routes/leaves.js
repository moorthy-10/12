const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const notify = require('../utils/notify');

// Get leave requests
router.get('/', authenticateToken, (req, res) => {
    const { user_id, status, leave_type, start_date, end_date } = req.query;

    let query = `
    SELECT l.*, 
           u.name as user_name, u.email, u.department,
           r.name as reviewer_name
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    LEFT JOIN users r ON l.reviewed_by = r.id
    WHERE 1=1
  `;
    const params = [];

    // If employee, only show their own requests
    if (req.user.role === 'employee') {
        query += ' AND l.user_id = ?';
        params.push(req.user.id);
    } else if (user_id) {
        query += ' AND l.user_id = ?';
        params.push(user_id);
    }

    if (status) {
        query += ' AND l.status = ?';
        params.push(status);
    }

    if (leave_type) {
        query += ' AND l.leave_type = ?';
        params.push(leave_type);
    }

    if (start_date) {
        query += ' AND l.start_date >= ?';
        params.push(start_date);
    }

    if (end_date) {
        query += ' AND l.end_date <= ?';
        params.push(end_date);
    }

    query += ' ORDER BY l.created_at DESC';

    db.all(query, params, (err, leaves) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, leaves });
    });
});

// Get single leave request
router.get('/:id', authenticateToken, (req, res) => {
    db.get(`
    SELECT l.*, 
           u.name as user_name, u.email, u.department,
           r.name as reviewer_name
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    LEFT JOIN users r ON l.reviewed_by = r.id
    WHERE l.id = ?
  `, [req.params.id], (err, leave) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (!leave) {
            return res.status(404).json({ success: false, message: 'Leave request not found' });
        }

        // Employees can only view their own requests
        if (req.user.role === 'employee' && leave.user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, leave });
    });
});

// Create leave request
router.post('/', authenticateToken, [
    body('leave_type').isIn(['sick', 'casual', 'vacation', 'unpaid']),
    body('start_date').isDate(),
    body('end_date').isDate(),
    body('days').isInt({ min: 1 }),
    body('reason').notEmpty().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { leave_type, start_date, end_date, days, reason } = req.body;
    const user_id = req.user.id; // Always create for logged-in user

    db.run(`
    INSERT INTO leaves (user_id, leave_type, start_date, end_date, days, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [user_id, leave_type, start_date, end_date, days, reason], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to create leave request' });
        }

        db.get(`
      SELECT l.*, 
             u.name as user_name, u.email, u.department
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      WHERE l.id = ?
    `, [this.lastID], (err, leave) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Leave request created but failed to fetch' });
            }
            res.status(201).json({ success: true, message: 'Leave request created successfully', leave });
        });
    });
});

// Update leave request (only pending requests by owner)
router.put('/:id', authenticateToken, [
    body('leave_type').optional().isIn(['sick', 'casual', 'vacation', 'unpaid']),
    body('start_date').optional().isDate(),
    body('end_date').optional().isDate(),
    body('days').optional().isInt({ min: 1 }),
    body('reason').optional().notEmpty().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    // First check if request exists and is editable
    db.get('SELECT * FROM leaves WHERE id = ?', [req.params.id], (err, leave) => {
        if (err || !leave) {
            return res.status(404).json({ success: false, message: 'Leave request not found' });
        }

        // Only the owner can edit their own pending requests
        if (leave.user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (leave.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Cannot edit a reviewed leave request' });
        }

        const { leave_type, start_date, end_date, days, reason } = req.body;
        const updates = [];
        const params = [];

        if (leave_type) { updates.push('leave_type = ?'); params.push(leave_type); }
        if (start_date) { updates.push('start_date = ?'); params.push(start_date); }
        if (end_date) { updates.push('end_date = ?'); params.push(end_date); }
        if (days) { updates.push('days = ?'); params.push(days); }
        if (reason) { updates.push('reason = ?'); params.push(reason); }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        params.push(req.params.id);
        const query = `UPDATE leaves SET ${updates.join(', ')} WHERE id = ?`;

        db.run(query, params, function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to update leave request' });
            }

            db.get(`
        SELECT l.*, 
               u.name as user_name, u.email, u.department
        FROM leaves l
        JOIN users u ON l.user_id = u.id
        WHERE l.id = ?
      `, [req.params.id], (err, leave) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Leave request updated but failed to fetch' });
                }
                res.json({ success: true, message: 'Leave request updated successfully', leave });
            });
        });
    });
});

// Review leave request (Admin only)
router.put('/:id/review', authenticateToken, isAdmin, [
    body('status').isIn(['approved', 'rejected']),
    body('review_notes').optional().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { status, review_notes } = req.body;

    db.get('SELECT * FROM leaves WHERE id = ?', [req.params.id], (err, leave) => {
        if (err || !leave) {
            return res.status(404).json({ success: false, message: 'Leave request not found' });
        }

        if (leave.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'This leave request has already been reviewed' });
        }

        db.run(`
      UPDATE leaves 
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?
      WHERE id = ?
    `, [status, req.user.id, review_notes, req.params.id], function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to review leave request' });
            }

            db.get(`
        SELECT l.*, 
               u.name as user_name, u.email, u.department,
               r.name as reviewer_name
        FROM leaves l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users r ON l.reviewed_by = r.id
        WHERE l.id = ?
      `, [req.params.id], (err, leave) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Leave request reviewed but failed to fetch' });
                }

                // Notify the employee of the decision
                const io = req.app.get('io');
                const emoji = status === 'approved' ? '✅' : '❌';
                notify(io, {
                    userId: leave.user_id,
                    type: 'leave',
                    title: `${emoji} Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                    message: `Your leave request (${leave.leave_type}, ${leave.start_date} – ${leave.end_date}) has been ${status}.${review_notes ? ` Note: ${review_notes}` : ''
                        }`,
                    relatedId: leave.id
                });

                res.json({ success: true, message: `Leave request ${status} successfully`, leave });
            });
        });
    });
});

// Delete leave request (Pending requests only, by owner or admin)
router.delete('/:id', authenticateToken, (req, res) => {
    db.get('SELECT * FROM leaves WHERE id = ?', [req.params.id], (err, leave) => {
        if (err || !leave) {
            return res.status(404).json({ success: false, message: 'Leave request not found' });
        }

        // Only admin or owner can delete
        if (req.user.role !== 'admin' && leave.user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Can only delete pending requests
        if (leave.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Cannot delete a reviewed leave request' });
        }

        db.run('DELETE FROM leaves WHERE id = ?', [req.params.id], function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to delete leave request' });
            }

            res.json({ success: true, message: 'Leave request deleted successfully' });
        });
    });
});

module.exports = router;
