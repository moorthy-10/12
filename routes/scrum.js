'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ScrumSession = require('../models/ScrumSession');
const User = require('../models/User');
const { authenticateToken, authorize } = require('../middleware/auth');
const { saveNotification, sendPushToMultipleUsers } = require('../services/notificationService');

// ── POST /api/scrum/start ───────────────────────────────────────────────────
router.post('/start', authenticateToken, authorize(['START_SCRUM']), async (req, res) => {
    try {
        const { title, meet_link, department_id } = req.body;

        if (!title || !meet_link) {
            return res.status(400).json({ success: false, message: 'Title and Meet link are required' });
        }

        // Create the session
        const session = await ScrumSession.create({
            title,
            meet_link,
            department: department_id || req.user.department_ref || null,
            started_by: req.user.id,
            status: 'live',
            participants: [req.user.id] // Starter joins automatically
        });

        // Identify scoped users for notification
        const perms = req.user.permissions || [];
        const isHrAdmin = perms.includes('VIEW_ALL_ATTENDANCE') || req.user.role === 'admin';
        const isHr = perms.includes('VIEW_DEPARTMENT_ATTENDANCE') && !isHrAdmin;
        const isManager = perms.includes('APPROVE_TEAM_LEAVE') && !isHrAdmin && !isHr;

        const filter = { status: 'active', _id: { $ne: req.user.id } };

        if (isHrAdmin) {
            // No additional filter
        } else if (isHr) {
            const deptId = req.user.department_ref || department_id;
            if (deptId) filter.department_ref = deptId;
        } else if (isManager) {
            filter.reports_to = req.user.id;
        } else {
            // Team Lead scenario - scope to their team (reports_to) as well
            filter.reports_to = req.user.id;
        }

        const targetUsers = await User.find(filter).select('_id name');
        const targetUserIds = targetUsers.map(u => u._id.toString());

        if (targetUserIds.length > 0) {
            console.log(`[Scrum] Notifying ${targetUserIds.length} users about scrum: ${title}`);

            // 1. Send Push Notification
            sendPushToMultipleUsers(
                targetUserIds,
                'Scrum Call Started',
                `${req.user.name} has started a scrum call: ${title}`,
                {
                    type: 'SCRUM_STARTED',
                    sessionId: session._id.toString(),
                    meet_link: meet_link
                }
            );

            // 2. Persist in DB & Emit Socket
            for (const uid of targetUserIds) {
                saveNotification({
                    userId: uid,
                    type: 'SCRUM_STARTED',
                    title: 'Scrum Call Started',
                    message: `${req.user.name} started a meeting: ${title}`,
                    relatedId: session._id.toString(),
                    relatedModel: 'ScrumSession',
                    priority: 'high'
                });
            }

            // 3. Global Broadcast for live UI update (Non-blocking)
            try {
                const io = global.io;
                if (io) {
                    io.emit('SCRUM_STARTED', {
                        sessionId: session._id,
                        title,
                        meet_link,
                        started_by: req.user.name
                    });
                }
            } catch (err) { }
        }

        res.status(201).json({ success: true, message: 'Scrum call started', session });

    } catch (error) {
        console.error('POST /scrum/start error:', error);
        res.status(500).json({ success: false, message: 'Failed to start scrum call' });
    }
});

// ── POST /api/scrum/join/:id ────────────────────────────────────────────────
router.post('/join/:id', authenticateToken, authorize(['JOIN_SCRUM']), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid Session ID' });
        }

        const session = await ScrumSession.findById(req.params.id);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        if (!session.participants.includes(req.user.id)) {
            session.participants.push(req.user.id);
            await session.save();
        }

        res.json({ success: true, message: 'Joined scrum call successfully', session });

    } catch (error) {
        console.error('POST /scrum/join error:', error);
        res.status(500).json({ success: false, message: 'Failed to join scrum call' });
    }
});

module.exports = router;
