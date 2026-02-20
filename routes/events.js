'use strict';

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// ── Helpers ───────────────────────────────────────────────────────────────────
const EVENT_COLORS = {
    holiday: '#ef4444',
    meeting: '#3b82f6',
    announcement: '#22c55e',
    training: '#f97316',
    'company-event': '#8b5cf6',
    other: '#6b7280'
};

function expandRecurring(event, rangeStart, rangeEnd) {
    const freq = event.recurrence || 'none';
    if (freq === 'none') return [];

    const interval = Math.max(1, event.recurrence_interval || 1);
    const origStart = new Date(event.start_date);
    const origEnd = new Date(event.end_date);
    const duration = origEnd.getTime() - origStart.getTime();

    const results = [];
    let cursor = new Date(origStart);
    let safety = 0;

    while (cursor <= rangeEnd && safety < 500) {
        safety++;
        if (cursor.getTime() !== origStart.getTime()) {
            const occEnd = new Date(cursor.getTime() + duration);
            if (cursor <= rangeEnd && occEnd >= rangeStart) {
                results.push({
                    ...event,
                    id: `${event.id}-${cursor.toISOString().slice(0, 10)}`,
                    start_date: cursor.toISOString().slice(0, 10),
                    end_date: occEnd.toISOString().slice(0, 10),
                    _virtual: true
                });
            }
        }
        const next = new Date(cursor);
        if (freq === 'monthly') next.setMonth(next.getMonth() + interval);
        else if (freq === 'yearly') next.setFullYear(next.getFullYear() + interval);
        cursor = next;
    }
    return results;
}

function formatEvent(ev) {
    const type = ev.type || ev.event_type || 'other';
    const allDay = ev.all_day === 1 || ev.all_day === true || ev.all_day == null;

    let start = ev.start_date;
    let end = ev.end_date;

    if (!allDay && ev.start_time) start = `${ev.start_date}T${ev.start_time}`;

    if (!allDay && ev.end_time) {
        const [h, m] = ev.end_time.split(':').map(Number);
        let endMins = h * 60 + m + 1;
        const endH = String(Math.floor(endMins / 60)).padStart(2, '0');
        const endM = String(endMins % 60).padStart(2, '0');
        end = `${ev.end_date}T${endH}:${endM}`;
    } else if (!allDay) {
        end = start;
    }

    if (allDay && end) {
        const d = new Date(end);
        d.setDate(d.getDate() + 1);
        end = d.toISOString().slice(0, 10);
    }

    // Normalise participants into a plain array of ID strings
    const participants = (ev.participants || []).map(p =>
        (typeof p === 'object' && p !== null)
            ? (p._id?.toString() || p.toString())
            : String(p)
    );

    return {
        id: String(ev.id || ev._id),
        title: ev.title,
        description: ev.description || '',
        start, end, allDay,
        location: ev.location || '',
        type,
        backgroundColor: EVENT_COLORS[type] || EVENT_COLORS.other,
        borderColor: EVENT_COLORS[type] || EVENT_COLORS.other,
        textColor: '#fff',
        recurrence: ev.recurrence || 'none',
        recurrence_interval: ev.recurrence_interval || 1,
        is_holiday: ev.is_holiday ? 1 : 0,
        created_by: ev.created_by?._id?.toString() || ev.created_by?.toString(),
        created_by_name: ev.created_by?.name || ev.created_by_name || undefined,
        participants,
        _virtual: ev._virtual || false
    };
}

// ── GET /api/events?month=YYYY-MM ─────────────────────────────────────────────
router.get('/', authenticateToken, [
    query('month').optional().matches(/^\d{4}-\d{2}$/)
], async (req, res) => {
    try {
        let rangeStart, rangeEnd;

        if (req.query.month) {
            const [year, month] = req.query.month.split('-').map(Number);
            rangeStart = new Date(year, month - 1, 1);
            rangeEnd = new Date(year, month, 0);
        } else {
            const now = new Date();
            rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
            rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        const rsStr = rangeStart.toISOString().slice(0, 10);
        const reStr = rangeEnd.toISOString().slice(0, 10);

        // Fetch all events that overlap the range OR are recurring
        const rows = await CalendarEvent.find({
            $or: [
                { start_date: { $lte: reStr }, end_date: { $gte: rsStr } },
                { recurrence: { $nin: ['none', ''] } }
            ]
        })
            .populate('created_by', 'name')
            .populate('participants', '_id')
            .sort({ start_date: 1 });

        const results = [];
        for (const row of rows) {
            const plain = row.toJSON ? row.toJSON() : row;
            plain.created_by_name = row.created_by?.name;
            const freq = plain.recurrence || 'none';

            if (freq === 'none' || !freq) {
                if (plain.start_date <= reStr && plain.end_date >= rsStr) results.push(plain);
                continue;
            }
            if (plain.start_date <= reStr && plain.end_date >= rsStr) results.push(plain);
            const occurrences = expandRecurring(plain, rangeStart, rangeEnd);
            results.push(...occurrences);
        }

        res.json({ success: true, events: results.map(formatEvent) });
    } catch (error) {
        console.error('GET /api/events error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/events/:id ───────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const event = await CalendarEvent.findById(req.params.id)
            .populate('created_by', 'name')
            .populate('participants', '_id');
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        const plain = event.toJSON();
        plain.created_by_name = event.created_by?.name;
        res.json({ success: true, event: formatEvent(plain) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── POST /api/events ──────────────────────────────────────────────────────────
router.post('/', authenticateToken, isAdmin, [
    body('title').notEmpty().trim().isLength({ max: 200 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('startDate').notEmpty().isISO8601(),
    body('endDate').notEmpty().isISO8601(),
    body('allDay').optional().isBoolean(),
    body('location').optional().trim().isLength({ max: 200 }),
    body('type').optional().isIn(['holiday', 'meeting', 'announcement', 'training', 'company-event', 'other']),
    body('recurrence').optional().isIn(['none', 'monthly', 'yearly']),
    body('recurrenceInterval').optional().isInt({ min: 1, max: 99 }),
    body('participants').optional().isArray()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const {
        title, description = '', startDate, endDate,
        allDay = true, location = '', type = 'announcement',
        recurrence = 'none', recurrenceInterval = 1,
        participants: rawParticipants = []
    } = req.body;

    const startStr = startDate.slice(0, 10);
    const endStr = endDate.slice(0, 10);

    if (new Date(startStr) > new Date(endStr)) {
        return res.status(400).json({ success: false, message: 'End date must be on or after start date' });
    }

    const LEGACY_TYPES = ['holiday', 'company-event', 'meeting', 'other'];
    const legacyEventType = LEGACY_TYPES.includes(type) ? type : 'other';
    const startTime = !allDay && startDate.includes('T') ? startDate.slice(11, 16) : null;
    const endTime = !allDay && endDate.includes('T') ? endDate.slice(11, 16) : null;

    // Validate participant IDs (if any supplied)
    let participantIds = [];
    if (Array.isArray(rawParticipants) && rawParticipants.length > 0) {
        const found = await User.find({ _id: { $in: rawParticipants } }).select('_id');
        participantIds = found.map(u => u._id);
    }

    try {
        const created = await CalendarEvent.create({
            title, description, event_type: legacyEventType, type,
            start_date: startStr, end_date: endStr,
            is_holiday: type === 'holiday',
            all_day: !!allDay, location, start_time: startTime, end_time: endTime,
            recurrence, recurrence_interval: recurrenceInterval,
            created_by: req.user.id,
            participants: participantIds
        });

        const event = await CalendarEvent.findById(created._id)
            .populate('created_by', 'name')
            .populate('participants', '_id');
        const plain = event.toJSON();
        plain.created_by_name = event.created_by?.name;

        res.status(201).json({ success: true, message: 'Event created', event: formatEvent(plain) });
    } catch (error) {
        console.error('POST /api/events error:', error);
        res.status(500).json({ success: false, message: 'Failed to create event' });
    }
});

// ── PUT /api/events/:id ───────────────────────────────────────────────────────
router.put('/:id', authenticateToken, isAdmin, [
    body('title').optional().notEmpty().trim().isLength({ max: 200 }),
    body('description').optional().trim(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('allDay').optional().isBoolean(),
    body('location').optional().trim(),
    body('type').optional().isIn(['holiday', 'meeting', 'announcement', 'training', 'company-event', 'other']),
    body('recurrence').optional().isIn(['none', 'monthly', 'yearly']),
    body('recurrenceInterval').optional().isInt({ min: 1, max: 99 }),
    body('participants').optional().isArray()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { title, description, startDate, endDate, allDay, location, type, recurrence, recurrenceInterval, participants: rawParticipants } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (location !== undefined) updates.location = location;
    if (allDay !== undefined) updates.all_day = !!allDay;
    if (recurrence !== undefined) updates.recurrence = recurrence;
    if (recurrenceInterval !== undefined) updates.recurrence_interval = recurrenceInterval;

    if (type !== undefined) {
        const LEGACY = ['holiday', 'company-event', 'meeting', 'other'];
        updates.type = type;
        updates.event_type = LEGACY.includes(type) ? type : 'other';
        updates.is_holiday = type === 'holiday';
    }
    if (startDate !== undefined) {
        updates.start_date = startDate.slice(0, 10);
        updates.start_time = !allDay && startDate.includes('T') ? startDate.slice(11, 16) : null;
    }
    if (endDate !== undefined) {
        updates.end_date = endDate.slice(0, 10);
        updates.end_time = !allDay && endDate.includes('T') ? endDate.slice(11, 16) : null;
    }

    // Handle participants update
    if (Array.isArray(rawParticipants)) {
        if (rawParticipants.length > 0) {
            const found = await User.find({ _id: { $in: rawParticipants } }).select('_id');
            updates.participants = found.map(u => u._id);
        } else {
            updates.participants = []; // allow clearing participants
        }
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    try {
        const event = await CalendarEvent.findByIdAndUpdate(
            req.params.id, { $set: updates }, { new: true }
        ).populate('created_by', 'name').populate('participants', '_id');

        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        const plain = event.toJSON();
        plain.created_by_name = event.created_by?.name;
        res.json({ success: true, message: 'Event updated', event: formatEvent(plain) });
    } catch (error) {
        console.error('PUT /api/events/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to update event' });
    }
});

// ── DELETE /api/events/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await CalendarEvent.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Event not found' });
        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

module.exports = router;
