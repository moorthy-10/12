const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all calendar events (All authenticated users can view)
router.get('/', authenticateToken, (req, res) => {
    const { start_date, end_date, event_type, is_holiday } = req.query;

    let query = `
    SELECT e.*, u.name as created_by_name
    FROM calendar_events e
    JOIN users u ON e.created_by = u.id
    WHERE 1=1
  `;
    const params = [];

    if (start_date) {
        query += ' AND e.end_date >= ?';
        params.push(start_date);
    }

    if (end_date) {
        query += ' AND e.start_date <= ?';
        params.push(end_date);
    }

    if (event_type) {
        query += ' AND e.event_type = ?';
        params.push(event_type);
    }

    if (is_holiday !== undefined) {
        query += ' AND e.is_holiday = ?';
        params.push(is_holiday === 'true' || is_holiday === '1' ? 1 : 0);
    }

    query += ' ORDER BY e.start_date ASC';

    db.all(query, params, (err, events) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, events });
    });
});

// Get single calendar event
router.get('/:id', authenticateToken, (req, res) => {
    db.get(`
    SELECT e.*, u.name as created_by_name
    FROM calendar_events e
    JOIN users u ON e.created_by = u.id
    WHERE e.id = ?
  `, [req.params.id], (err, event) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        res.json({ success: true, event });
    });
});

// Check if a specific date is a holiday
router.get('/check-holiday/:date', authenticateToken, (req, res) => {
    const { date } = req.params;

    db.get(`
    SELECT * FROM calendar_events
    WHERE is_holiday = 1
      AND start_date <= ?
      AND end_date >= ?
    LIMIT 1
  `, [date, date], (err, holiday) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        res.json({
            success: true,
            isHoliday: !!holiday,
            holiday: holiday || null
        });
    });
});

// Create calendar event (Admin only)
router.post('/', authenticateToken, isAdmin, [
    body('title').notEmpty().trim(),
    body('description').optional().trim(),
    body('event_type').isIn(['holiday', 'company-event', 'meeting', 'other']),
    body('start_date').isDate(),
    body('end_date').isDate(),
    body('is_holiday').optional().isBoolean()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, event_type, start_date, end_date, is_holiday } = req.body;
    const created_by = req.user.id;

    // Validate end_date >= start_date
    if (new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({
            success: false,
            message: 'End date must be on or after start date'
        });
    }

    // If event_type is holiday, automatically set is_holiday to 1
    const holidayFlag = event_type === 'holiday' ? 1 : (is_holiday ? 1 : 0);

    db.run(`
    INSERT INTO calendar_events (title, description, event_type, start_date, end_date, is_holiday, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [title, description, event_type, start_date, end_date, holidayFlag, created_by], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to create event' });
        }

        db.get(`
      SELECT e.*, u.name as created_by_name
      FROM calendar_events e
      JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `, [this.lastID], (err, event) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Event created but failed to fetch' });
            }
            res.status(201).json({ success: true, message: 'Event created successfully', event });
        });
    });
});

// Update calendar event (Admin only)
router.put('/:id', authenticateToken, isAdmin, [
    body('title').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('event_type').optional().isIn(['holiday', 'company-event', 'meeting', 'other']),
    body('start_date').optional().isDate(),
    body('end_date').optional().isDate(),
    body('is_holiday').optional().isBoolean()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, event_type, start_date, end_date, is_holiday } = req.body;
    const updates = [];
    const params = [];

    if (title) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (event_type) {
        updates.push('event_type = ?');
        params.push(event_type);
        // Auto-set is_holiday if event_type is holiday
        if (event_type === 'holiday') {
            updates.push('is_holiday = 1');
        }
    }
    if (start_date) { updates.push('start_date = ?'); params.push(start_date); }
    if (end_date) { updates.push('end_date = ?'); params.push(end_date); }
    if (is_holiday !== undefined) { updates.push('is_holiday = ?'); params.push(is_holiday ? 1 : 0); }

    if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    const query = `UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, params, function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to update event' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        db.get(`
      SELECT e.*, u.name as created_by_name
      FROM calendar_events e
      JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `, [req.params.id], (err, event) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Event updated but failed to fetch' });
            }
            res.json({ success: true, message: 'Event updated successfully', event });
        });
    });
});

// Delete calendar event (Admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM calendar_events WHERE id = ?', [req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to delete event' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        res.json({ success: true, message: 'Event deleted successfully' });
    });
});

module.exports = router;
