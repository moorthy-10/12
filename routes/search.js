'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const Task = require('../models/Task');
const Leave = require('../models/Leave');
const CalendarEvent = require('../models/CalendarEvent');
const Group = require('../models/Group');

/**
 * GET /api/search?q=keyword
 * Global search across multiple modules.
 * Returns limited results to maintain performance.
 */
router.get('/', authenticateToken, async (req, res) => {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
        return res.json({
            success: true,
            results: { users: [], tasks: [], leaves: [], events: [], groups: [] }
        });
    }

    const keyword = q.trim();
    const regex = new RegExp(keyword, 'i');

    try {
        const [users, tasks, leaves, events, groups] = await Promise.all([
            // Users search
            User.find({
                $or: [{ name: regex }, { email: regex }]
            }).limit(10).select('name email role').lean(),

            // Tasks search
            Task.find({ title: regex })
                .limit(10)
                .select('title status priority')
                .lean(),

            // Leaves search (populated name)
            Leave.find()
                .populate({
                    path: 'user',
                    match: { name: regex },
                    select: 'name'
                })
                .limit(20) // Get more to filter nulls after populate
                .lean()
                .then(docs => docs.filter(d => d.user).slice(0, 10)),

            // Calendar events search
            CalendarEvent.find({ title: regex })
                .limit(10)
                .select('title start type')
                .lean(),

            // Groups search
            Group.find({ name: regex })
                .limit(10)
                .select('name description')
                .lean()
        ]);

        res.json({
            success: true,
            results: {
                users: users.map(u => ({ id: u._id, title: u.name, caption: u.email, category: 'User', link: `/employees` })),
                tasks: tasks.map(t => ({ id: t._id, title: t.title, caption: `${t.status} | ${t.priority}`, category: 'Task', link: `/tasks` })),
                leaves: leaves.map(l => ({ id: l._id, title: l.user.name, caption: `Leave request (${l.status})`, category: 'Leave', link: `/leaves` })),
                events: events.map(e => ({ id: e._id, title: e.title, caption: `${e.type} | ${new Date(e.start).toLocaleDateString()}`, category: 'Event', link: `/calendar` })),
                groups: groups.map(g => ({ id: g._id, title: g.name, caption: g.description, category: 'Group', link: `/groups` }))
            }
        });
    } catch (error) {
        console.error('Global search error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
