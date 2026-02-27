'use strict';

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Leave = require('../models/Leave');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');
const { authenticateToken, isAdmin, authorize } = require('../middleware/auth');
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

        const perms = req.user.permissions || [];
        const isHrAdmin = perms.includes('APPROVE_ANY_LEAVE') || req.user.role === 'admin';
        const isHr = perms.includes('APPROVE_DEPARTMENT_LEAVE') && !isHrAdmin;
        const isManager = perms.includes('APPROVE_TEAM_LEAVE') && !isHrAdmin && !isHr;

        if (isHrAdmin) {
            if (user_id) filter.user = user_id;
        } else if (isHr) {
            const targetDept = req.user.department_ref;
            if (!targetDept) return res.status(403).json({ success: false, message: 'HR department not configured' });

            const usersInDept = await User.find({ department_ref: targetDept }).select('_id');
            filter.user = { $in: usersInDept.map(u => u._id) };
            if (user_id && filter.user.$in.some(id => id.toString() === user_id)) {
                filter.user = user_id;
            }
        } else if (isManager) {
            const reports = await User.find({ reports_to: req.user.id }).select('_id');
            const reportIds = reports.map(u => u._id);
            reportIds.push(req.user.id);
            filter.user = { $in: reportIds };
            if (user_id && filter.user.$in.some(id => id.toString() === user_id)) {
                filter.user = user_id;
            }
        } else {
            // Employee / Intern - Self only
            filter.user = req.user.id;
        }

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
router.put('/:id/review', authenticateToken, authorize(['APPROVE_TEAM_LEAVE', 'APPROVE_DEPARTMENT_LEAVE', 'APPROVE_ANY_LEAVE']), [
    body('status').isIn(['approved', 'rejected']),
    body('review_notes').optional().trim()
], async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { status, review_notes } = req.body;
    const userId = req.user.id;
    const roles = req.user.roles || [req.user.role];
    const perms = req.user.permissions || [];

    try {
        const leave = await Leave.findById(req.params.id).populate('user');
        if (!leave) return res.status(404).json({ success: false, message: 'Leave request not found' });

        if (leave.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'This leave request has already been finalized' });
        }

        // Scope Enforcement
        const isHrAdmin = perms.includes('APPROVE_ANY_LEAVE') || req.user.role === 'admin';
        const isHr = perms.includes('APPROVE_DEPARTMENT_LEAVE') && !isHrAdmin;
        const isManager = perms.includes('APPROVE_TEAM_LEAVE') && !isHrAdmin && !isHr;

        let authorized = false;
        if (isHrAdmin) authorized = true;
        else if (isHr && req.user.department_ref && leave.user?.department_ref) {
            if (req.user.department_ref.toString() === leave.user.department_ref.toString()) authorized = true;
        } else if (isManager && leave.user?.reports_to) {
            if (leave.user.reports_to.toString() === req.user.id) authorized = true;
        }

        if (!authorized) {
            return res.status(403).json({ success: false, message: 'Access denied: Out of scope for your role' });
        }

        // Case 1: Rejection
        if (status === 'rejected') {
            leave.status = 'rejected';
            leave.reviewed_by = userId;
            leave.reviewed_at = new Date();
            leave.review_notes = review_notes || 'Rejected';
            await leave.save();
        }
        // Case 2: Approval
        else {
            if (!leave.approved_by.includes(userId)) leave.approved_by.push(userId);

            const isFinalApprover = perms.includes('APPROVE_ANY_LEAVE') || perms.includes('APPROVE_DEPARTMENT_LEAVE') || req.user.role === 'admin';

            if (isFinalApprover) {
                leave.status = 'approved';
                leave.reviewed_by = userId;
                leave.reviewed_at = new Date();
                leave.review_notes = review_notes || 'Final approval';
            } else {
                leave.review_notes = (leave.review_notes ? leave.review_notes + ' | ' : '') + 'Approved by Manager';
            }
            await leave.save();
        }

        const doc = await Leave.findById(leave._id).populate(POP);
        const finalStatus = doc.status;

        // Notify and Sync only if status changed from pending
        if (finalStatus !== 'pending') {
            const io = req.app.get('io');
            const emoji = finalStatus === 'approved' ? '✅' : '❌';
            notify(io, {
                userId: doc.user._id.toString(),
                type: 'leave',
                title: `${emoji} Leave Request ${finalStatus.charAt(0).toUpperCase() + finalStatus.slice(1)}`,
                message: `Your leave request has been ${finalStatus}.`,
                relatedId: doc._id.toString()
            });

            sendPushToUser(doc.user._id.toString(), `Leave ${finalStatus}`, `Your leave request has been ${finalStatus}`, {
                type: finalStatus === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
                leaveId: doc._id.toString()
            });

            if (finalStatus === 'approved') {
                await CalendarEvent.findOneAndUpdate(
                    { linkedLeaveId: doc._id },
                    {
                        title: `${doc.user.name} - On Leave`,
                        event_type: 'leave',
                        start_date: doc.start_date,
                        end_date: doc.end_date,
                        created_by: userId,
                        linkedLeaveId: doc._id,
                        description: `Approved leave. Reason: ${doc.reason}`
                    },
                    { upsert: true, new: true }
                );
            } else {
                await CalendarEvent.findOneAndDelete({ linkedLeaveId: doc._id });
            }
        }

        res.json({ success: true, message: `Review processed. Status: ${finalStatus}`, leave: shapeLeave(doc) });
    } catch (error) {
        console.error('PUT /leaves/:id/review error:', error);
        res.status(500).json({ success: false, message: 'Server error during review' });
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

        const canManage = (req.user.permissions || []).includes('MANAGE_EMPLOYEES') || req.user.role === 'admin';
        if (!canManage && existing.user.toString() !== req.user.id) {
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
