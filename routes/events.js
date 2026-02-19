const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// ── Ensure new columns exist (safe, idempotent) ──────────────────────────────
// These ADD COLUMN statements are safe with IF NOT EXISTS guard via try/catch.
const migrate = () => {
    const migrations = [
        `ALTER TABLE calendar_events ADD COLUMN all_day INTEGER DEFAULT 1`,
        `ALTER TABLE calendar_events ADD COLUMN location TEXT`,
        `ALTER TABLE calendar_events ADD COLUMN start_time TEXT`,
        `ALTER TABLE calendar_events ADD COLUMN end_time TEXT`,
        `ALTER TABLE calendar_events ADD COLUMN recurrence TEXT DEFAULT 'none'`,
        `ALTER TABLE calendar_events ADD COLUMN recurrence_interval INTEGER DEFAULT 1`,
        `ALTER TABLE calendar_events ADD COLUMN type TEXT DEFAULT 'announcement'`
    ];
    migrations.forEach(sql => {
        db.run(sql, [], (err) => {
            // Silently skip "duplicate column" errors — expected on re-start
            if (err && !err.message.includes('duplicate column')) {
                console.error('Migration warning:', err.message);
            }
        });
    });
};
migrate();

// ── DB helpers ────────────────────────────────────────────────────────────────
const dbGet = (sql, params) =>
    new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
    );

const dbAll = (sql, params) =>
    new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    );

const dbRun = (sql, params) =>
    new Promise((resolve, reject) =>
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        })
    );

// ── Helpers ───────────────────────────────────────────────────────────────────
const EVENT_COLORS = {
    holiday: '#ef4444',
    meeting: '#3b82f6',
    announcement: '#22c55e',
    training: '#f97316',
    'company-event': '#8b5cf6',
    other: '#6b7280'
};

/**
 * Given a base event from the DB, expand recurring occurrences that fall
 * within [rangeStart, rangeEnd]. Returns array of virtual event objects.
 * No DB writes are performed.
 */
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
        // Skip the original occurrence itself (already in the base fetch)
        if (cursor.getTime() !== origStart.getTime()) {
            const occEnd = new Date(cursor.getTime() + duration);
            // Include if the occurrence overlaps with [rangeStart, rangeEnd]
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

        // Advance cursor by interval
        const next = new Date(cursor);
        if (freq === 'monthly') {
            next.setMonth(next.getMonth() + interval);
        } else if (freq === 'yearly') {
            next.setFullYear(next.getFullYear() + interval);
        }
        cursor = next;
    }
    return results;
}

/** Map DB row → FullCalendar-friendly shape */
function formatEvent(ev) {
    const type = ev.type || ev.event_type || 'other';
    const allDay = ev.all_day === 1 || ev.all_day === true || ev.all_day == null;

    let start = ev.start_date;
    let end = ev.end_date;

    if (!allDay && ev.start_time) {
        start = `${ev.start_date}T${ev.start_time}`;
    }
    if (!allDay && ev.end_time) {
        // FullCalendar treats end as exclusive; offset by 1 min for same‑day timed events
        const [h, m] = ev.end_time.split(':').map(Number);
        let endMins = h * 60 + m + 1;
        const endH = String(Math.floor(endMins / 60)).padStart(2, '0');
        const endM = String(endMins % 60).padStart(2, '0');
        end = `${ev.end_date}T${endH}:${endM}`;
    } else if (!allDay) {
        end = start;
    }

    // For multi-day all-day events, FullCalendar end is exclusive — add one day
    if (allDay && end) {
        const d = new Date(end);
        d.setDate(d.getDate() + 1);
        end = d.toISOString().slice(0, 10);
    }

    return {
        id: String(ev.id),
        title: ev.title,
        description: ev.description || '',
        start,
        end,
        allDay,
        location: ev.location || '',
        type,
        backgroundColor: EVENT_COLORS[type] || EVENT_COLORS.other,
        borderColor: EVENT_COLORS[type] || EVENT_COLORS.other,
        textColor: '#fff',
        recurrence: ev.recurrence || 'none',
        recurrence_interval: ev.recurrence_interval || 1,
        is_holiday: ev.is_holiday || 0,
        created_by: ev.created_by,
        created_by_name: ev.created_by_name,
        _virtual: ev._virtual || false
    };
}

// ── GET /api/events?month=YYYY-MM ─────────────────────────────────────────────
// Accessible by all authenticated users.
// Returns events for the given month, including expanded recurring ones.
router.get('/', authenticateToken, [
    query('month').optional().matches(/^\d{4}-\d{2}$/)
], async (req, res) => {
    try {
        let rangeStart, rangeEnd;

        if (req.query.month) {
            const [year, month] = req.query.month.split('-').map(Number);
            rangeStart = new Date(year, month - 1, 1);
            rangeEnd = new Date(year, month, 0); // last day of month
        } else {
            // Default: current month
            const now = new Date();
            rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
            rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        const rsStr = rangeStart.toISOString().slice(0, 10);
        const reStr = rangeEnd.toISOString().slice(0, 10);

        // Fetch events that either fall within range OR are recurring (fetch all recurring for expansion)
        const rows = await dbAll(
            `SELECT e.*, u.name as created_by_name
             FROM calendar_events e
             LEFT JOIN users u ON e.created_by = u.id
             WHERE (e.start_date <= ? AND e.end_date >= ?)
                OR e.recurrence NOT IN ('none', '')
                OR e.recurrence IS NULL
             ORDER BY e.start_date ASC`,
            [reStr, rsStr]
        );

        const results = [];

        for (const row of rows) {
            const freq = row.recurrence || 'none';

            // Non-recurring: include if it overlaps
            if (freq === 'none' || !freq) {
                if (row.start_date <= reStr && row.end_date >= rsStr) {
                    results.push(row);
                }
                continue;
            }

            // Recurring: include original if it overlaps, then expand
            if (row.start_date <= reStr && row.end_date >= rsStr) {
                results.push(row);
            }
            const occurrences = expandRecurring(row, rangeStart, rangeEnd);
            results.push(...occurrences);
        }

        res.json({ success: true, events: results.map(formatEvent) });
    } catch (err) {
        console.error('GET /api/events error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/events/:id ───────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const event = await dbGet(
            `SELECT e.*, u.name as created_by_name
             FROM calendar_events e
             LEFT JOIN users u ON e.created_by = u.id
             WHERE e.id = ?`,
            [req.params.id]
        );
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        res.json({ success: true, event: formatEvent(event) });
    } catch (err) {
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
    body('recurrenceInterval').optional().isInt({ min: 1, max: 99 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const {
        title, description = '', startDate, endDate,
        allDay = true, location = '', type = 'announcement',
        recurrence = 'none', recurrenceInterval = 1
    } = req.body;

    const startStr = startDate.slice(0, 10);
    const endStr = endDate.slice(0, 10);

    if (new Date(startStr) > new Date(endStr)) {
        return res.status(400).json({ success: false, message: 'End date must be on or after start date' });
    }

    // Map new type values to the legacy CHECK-constrained event_type column
    // The old constraint only allows: 'holiday' | 'company-event' | 'meeting' | 'other'
    const LEGACY_TYPES = ['holiday', 'company-event', 'meeting', 'other'];
    const legacyEventType = LEGACY_TYPES.includes(type) ? type : 'other';

    // Extract times if timed event
    const startTime = !allDay && startDate.includes('T') ? startDate.slice(11, 16) : null;
    const endTime = !allDay && endDate.includes('T') ? endDate.slice(11, 16) : null;
    const isHoliday = type === 'holiday' ? 1 : 0;

    try {
        const { lastID } = await dbRun(
            `INSERT INTO calendar_events
             (title, description, event_type, start_date, end_date, is_holiday,
              all_day, location, start_time, end_time, type, recurrence, recurrence_interval, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, legacyEventType, startStr, endStr, isHoliday,
                allDay ? 1 : 0, location, startTime, endTime, type,
                recurrence, recurrenceInterval, req.user.id]
        );

        const event = await dbGet(
            `SELECT e.*, u.name as created_by_name FROM calendar_events e
             LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
            [lastID]
        );

        res.status(201).json({ success: true, message: 'Event created', event: formatEvent(event) });
    } catch (err) {
        console.error('POST /api/events error:', err);
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
    body('recurrenceInterval').optional().isInt({ min: 1, max: 99 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const {
        title, description, startDate, endDate,
        allDay, location, type, recurrence, recurrenceInterval
    } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (allDay !== undefined) { updates.push('all_day = ?'); params.push(allDay ? 1 : 0); }
    if (recurrence !== undefined) { updates.push('recurrence = ?'); params.push(recurrence); }
    if (recurrenceInterval !== undefined) { updates.push('recurrence_interval = ?'); params.push(recurrenceInterval); }

    if (type !== undefined) {
        // Map to legacy CHECK-constrained event_type column
        const LEGACY_TYPES = ['holiday', 'company-event', 'meeting', 'other'];
        const legacyEventType = LEGACY_TYPES.includes(type) ? type : 'other';
        updates.push('type = ?'); params.push(type);
        updates.push('event_type = ?'); params.push(legacyEventType);
        updates.push('is_holiday = ?'); params.push(type === 'holiday' ? 1 : 0);
    }

    if (startDate !== undefined) {
        const startStr = startDate.slice(0, 10);
        const startTime = !allDay && startDate.includes('T') ? startDate.slice(11, 16) : null;
        updates.push('start_date = ?'); params.push(startStr);
        updates.push('start_time = ?'); params.push(startTime);
    }
    if (endDate !== undefined) {
        const endStr = endDate.slice(0, 10);
        const endTime = !allDay && endDate.includes('T') ? endDate.slice(11, 16) : null;
        updates.push('end_date = ?'); params.push(endStr);
        updates.push('end_time = ?'); params.push(endTime);
    }

    if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    try {
        const { changes } = await dbRun(
            `UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`, params
        );
        if (changes === 0) return res.status(404).json({ success: false, message: 'Event not found' });

        const event = await dbGet(
            `SELECT e.*, u.name as created_by_name FROM calendar_events e
             LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
            [req.params.id]
        );
        res.json({ success: true, message: 'Event updated', event: formatEvent(event) });
    } catch (err) {
        console.error('PUT /api/events error:', err);
        res.status(500).json({ success: false, message: 'Failed to update event' });
    }
});

// ── DELETE /api/events/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { changes } = await dbRun(
            'DELETE FROM calendar_events WHERE id = ?', [req.params.id]
        );
        if (changes === 0) return res.status(404).json({ success: false, message: 'Event not found' });
        res.json({ success: true, message: 'Event deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

module.exports = router;
