'use strict';

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const CalendarEvent = require('../models/CalendarEvent');
const { authenticateToken, isAdmin } = require('../middleware/auth');


// ── Shape helper ──────────────────────────────────────────────────────────────
function shapeEvent(e) {
    const obj = e.toJSON ? e.toJSON() : e;
    const creator = e.created_by;
    obj.created_by = creator?._id?.toString() || creator?.toString() || obj.created_by;
    obj.created_by_name = creator?.name || undefined;
    // Coerce is_holiday to 0/1 for legacy frontend
    obj.is_holiday = obj.is_holiday ? 1 : 0;
    return obj;
}

// ── GET /api/calendar ──────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date, event_type, is_holiday } = req.query;
        const filter = {};

        if (start_date) filter.end_date = { ...filter.end_date, $gte: start_date };
        if (end_date) filter.start_date = { ...filter.start_date, $lte: end_date };
        if (event_type) filter.event_type = event_type;
        if (is_holiday !== undefined) filter.is_holiday = is_holiday === 'true' || is_holiday === '1';

        const events = await CalendarEvent.find(filter)
            .populate('created_by', 'name')
            .sort({ start_date: 1 });

        res.json({ success: true, events: events.map(shapeEvent) });
    } catch (error) {
        console.error('GET /calendar error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/calendar/check-holiday/:date ─────────────────────────────────────
router.get('/check-holiday/:date', authenticateToken, async (req, res) => {
    const { date } = req.params;
    try {
        const holiday = await CalendarEvent.findOne({
            is_holiday: true,
            start_date: { $lte: date },
            end_date: { $gte: date }
        });
        res.json({ success: true, isHoliday: !!holiday, holiday: holiday ? shapeEvent(holiday) : null });
    } catch (error) {
        console.error('check-holiday error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/calendar/:id ──────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    try {
        const event = await CalendarEvent.findById(req.params.id).populate('created_by', 'name');
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        res.json({ success: true, event: shapeEvent(event) });
    } catch (error) {
        console.error('GET /calendar/:id error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── POST /api/calendar ─────────────────────────────────────────────────────────
router.post('/', authenticateToken, isAdmin, [
    body('title').notEmpty().trim(),
    body('description').optional().trim(),
    body('event_type').isIn(['holiday', 'company-event', 'meeting', 'other']),
    body('start_date').isDate(),
    body('end_date').isDate(),
    body('is_holiday').optional().isBoolean()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { title, description, event_type, start_date, end_date, is_holiday } = req.body;

    if (new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ success: false, message: 'End date must be on or after start date' });
    }

    const holidayFlag = event_type === 'holiday' ? true : !!is_holiday;

    try {
        const created = await CalendarEvent.create({
            title, description, event_type, start_date, end_date,
            is_holiday: holidayFlag,
            created_by: req.user.id
        });
        const event = await CalendarEvent.findById(created._id).populate('created_by', 'name');
        res.status(201).json({ success: true, message: 'Event created successfully', event: shapeEvent(event) });
    } catch (error) {
        console.error('POST /calendar error:', error);
        res.status(500).json({ success: false, message: 'Failed to create event' });
    }
});

// ── PUT /api/calendar/:id ──────────────────────────────────────────────────────
router.put('/:id', authenticateToken, isAdmin, [
    body('title').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('event_type').optional().isIn(['holiday', 'company-event', 'meeting', 'other']),
    body('start_date').optional().isDate(),
    body('end_date').optional().isDate(),
    body('is_holiday').optional().isBoolean()
], async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { title, description, event_type, start_date, end_date, is_holiday } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (event_type !== undefined) {
        updates.event_type = event_type;
        if (event_type === 'holiday') updates.is_holiday = true;
    }
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (is_holiday !== undefined) updates.is_holiday = !!is_holiday;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    try {
        const event = await CalendarEvent.findByIdAndUpdate(
            req.params.id, { $set: updates }, { new: true }
        ).populate('created_by', 'name');

        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        res.json({ success: true, message: 'Event updated successfully', event: shapeEvent(event) });
    } catch (error) {
        console.error('PUT /calendar/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to update event' });
    }
});

// ── DELETE /api/calendar/:id ───────────────────────────────────────────────────
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    try {
        const result = await CalendarEvent.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Event not found' });
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('DELETE /calendar/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

module.exports = router;
