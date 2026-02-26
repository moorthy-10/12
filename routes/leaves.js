'use strict';

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Leave = require('../models/Leave');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const notify = require('../utils/notify');
const { sendPushToUser, sendPushToMultipleUsers } = require('../services/notificationService');



// ── Shape helper ──────────────────────────────────────────────────────────────
function shapeLeave(doc) {
    const obj = doc.toJSON();
    const u = doc.user;
    obj.user_id = u._id ? u._id.toString() : (u || '').toString();
    obj.user_name = u.name || undefined;
    obj.email = u.email || undefined;
    obj.department = u.department || undefined;
    obj.reviewer_name = doc.reviewed_by?.name || null;
    return obj;
}

const POP = [
    { path: 'user', select: 'name email department' },
    { path: 'reviewed_by', select: 'name' }
];

// ── GET /api/leaves ────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { user_id, status, leave_type, start_date, end_date } = req.query;
        const filter = {};

        if (req.user.role === 'employee') filter.user = req.user.id;
        else if (user_id) filter.user = user_id;

        if (status) filter.status = status;
        if (leave_type) filter.leave_type = leave_type;
        if (start_date) filter.start_date = { ...filter.start_date, $gte: start_date };
        if (end_date) filter.end_date = { ...filter.end_date, $lte: end_date };

        const docs = await Leave.find(filter).populate(POP).sort({ createdAt: -1 });
        res.json({ success: true, leaves: docs.map(shapeLeave) });
    } catch (error) {
        console.error('GET /leaves error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/leaves/:id ────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    try {
        const doc = await Leave.findById(req.params.id).populate(POP);
        if (!doc) return res.status(404).json({ success: false, message: 'Leave request not found' });

        if (req.user.role === 'employee' && doc.user._id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, leave: shapeLeave(doc) });
    } catch (error) {
        console.error('GET /leaves/:id error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── POST /api/leaves ───────────────────────────────────────────────────────────
router.post('/', authenticateToken, [
    body('leave_type').isIn(['sick', 'casual', 'vacation', 'unpaid']),
    body('start_date').isDate(),
    body('end_date').isDate(),
    body('days').isInt({ min: 1 }),
    body('reason').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { leave_type, start_date, end_date, days, reason } = req.body;

    try {
        const created = await Leave.create({
            user: req.user.id, leave_type, start_date, end_date, days, reason
        });
        const doc = await Leave.findById(created._id).populate(POP);

        // Trigger Push to all Admins (non-blocking)
        try {
            const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
            const adminIds = admins.map(a => a._id.toString());
            const employeeName = req.user.name || 'An employee';

            sendPushToMultipleUsers(adminIds, 'New Leave Request', `${employeeName} submitted a leave request`, {
                type: 'LEAVE_REQUEST',
                leaveId: doc._id.toString()
            });
        } catch (pushErr) {
            console.error('Leave submission push error:', pushErr.message);
        }

        res.status(201).json({ success: true, message: 'Leave request created successfully', leave: shapeLeave(doc) });
    } catch (error) {
        console.error('POST /leaves error:', error);
        res.status(500).json({ success: false, message: 'Failed to create leave request' });
    }
});

// ── PUT /api/leaves/:id ────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, [
    body('leave_type').optional().isIn(['sick', 'casual', 'vacation', 'unpaid']),
    body('start_date').optional().isDate(),
    body('end_date').optional().isDate(),
    body('days').optional().isInt({ min: 1 }),
    body('reason').optional().notEmpty().trim()
], async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const existing = await Leave.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Leave request not found' });

        if (existing.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        if (existing.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Cannot edit a reviewed leave request' });
        }

        const { leave_type, start_date, end_date, days, reason } = req.body;
        const updates = {};
        if (leave_type !== undefined) updates.leave_type = leave_type;
        if (start_date !== undefined) updates.start_date = start_date;
        if (end_date !== undefined) updates.end_date = end_date;
        if (days !== undefined) updates.days = days;
        if (reason !== undefined) updates.reason = reason;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const doc = await Leave.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).populate(POP);
        res.json({ success: true, message: 'Leave request updated successfully', leave: shapeLeave(doc) });
    } catch (error) {
        console.error('PUT /leaves/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to update leave request' });
    }
});

// ── PUT /api/leaves/:id/review ─────────────────────────────────────────────────
router.put('/:id/review', authenticateToken, isAdmin, [
    body('status').isIn(['approved', 'rejected']),
    body('review_notes').optional().trim()
], async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { status, review_notes } = req.body;

    try {
        const existing = await Leave.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Leave request not found' });
        if (existing.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'This leave request has already been reviewed' });
        }

        const doc = await Leave.findByIdAndUpdate(req.params.id, {
            $set: {
                status,
                reviewed_by: req.user.id,
                reviewed_at: new Date(),
                review_notes: review_notes || ''
            }
        }, { new: true }).populate(POP);

        // Notify the employee (non-blocking)
        const io = req.app.get('io');
        const emoji = status === 'approved' ? '✅' : '❌';
        notify(io, {
            userId: doc.user._id.toString(),
            type: 'leave',
            title: `${emoji} Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Your leave request (${doc.leave_type}, ${doc.start_date} – ${doc.end_date}) has been ${status}.${review_notes ? ` Note: ${review_notes}` : ''}`,
            relatedId: doc._id.toString()
        });

        // Trigger Push Notification
        const pushTitle = status === 'approved' ? 'Leave Approved' : 'Leave Rejected';
        const pushBody = status === 'approved' ? 'Your leave request has been approved' : 'Your leave request has been rejected';
        const pushType = status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED';

        sendPushToUser(doc.user._id.toString(), pushTitle, pushBody, {
            type: pushType,
            leaveId: doc._id.toString()
        });

        // ── Calendar Sync ──
        if (status === 'approved') {
            // Create calendar event
            await CalendarEvent.findOneAndUpdate(
                { linkedLeaveId: doc._id },
                {
                    title: `${doc.user.name} - On Leave`,
                    event_type: 'leave',
                    start_date: doc.start_date,
                    end_date: doc.end_date,
                    created_by: req.user.id,
                    linkedLeaveId: doc._id,
                    description: `Approved leave: ${doc.leave_type}. Reason: ${doc.reason}`
                },
                { upsert: true, new: true }
            );
        } else if (status === 'rejected') {
            // Remove calendar event if it exists
            await CalendarEvent.findOneAndDelete({ linkedLeaveId: doc._id });
        }

        res.json({ success: true, message: `Leave request ${status} successfully`, leave: shapeLeave(doc) });
    } catch (error) {
        console.error('PUT /leaves/:id/review error:', error);
        res.status(500).json({ success: false, message: 'Failed to review leave request' });
    }
});

// ── DELETE /api/leaves/:id ─────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    try {
        const existing = await Leave.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Leave request not found' });

        if (req.user.role !== 'admin' && existing.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        if (existing.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Cannot delete a reviewed leave request' });
        }

        await CalendarEvent.findOneAndDelete({ linkedLeaveId: req.params.id });
        await Leave.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Leave request deleted successfully' });
    } catch (error) {
        console.error('DELETE /leaves/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete leave request' });
    }
});

module.exports = router;
