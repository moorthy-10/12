'use strict';

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const notify = require('../utils/notify');


// ── Shape helper ──────────────────────────────────────────────────────────────
function shapeTask(t) {
    const obj = t.toJSON();
    obj.assigned_to = t.assigned_to._id ? t.assigned_to._id.toString() : t.assigned_to.toString();
    obj.assigned_by = t.assigned_by._id ? t.assigned_by._id.toString() : t.assigned_by.toString();
    obj.assigned_to_name = t.assigned_to.name || undefined;
    obj.assigned_to_email = t.assigned_to.email || undefined;
    obj.assigned_by_name = t.assigned_by.name || undefined;
    return obj;
}

const POP = [
    { path: 'assigned_to', select: 'name email' },
    { path: 'assigned_by', select: 'name' }
];

// ── GET /api/tasks ─────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, priority, assigned_to } = req.query;
        const filter = {};

        if (req.user.role === 'employee') filter.assigned_to = req.user.id;
        else if (assigned_to) filter.assigned_to = assigned_to;

        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        const tasks = await Task.find(filter).populate(POP).sort({ createdAt: -1 });
        res.json({ success: true, tasks: tasks.map(shapeTask) });
    } catch (error) {
        console.error('GET /tasks error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/tasks/:id ─────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    try {
        const task = await Task.findById(req.params.id).populate(POP);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        if (req.user.role === 'employee' && task.assigned_to._id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, task: shapeTask(task) });
    } catch (error) {
        console.error('GET /tasks/:id error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── POST /api/tasks ────────────────────────────────────────────────────────────
router.post('/', authenticateToken, isAdmin, [
    body('title').notEmpty().trim(),
    body('description').optional().trim(),
    body('assigned_to').notEmpty(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('due_date').optional().isDate()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { title, description, assigned_to, priority, due_date } = req.body;
    const assigned_by = req.user.id;

    try {
        const assignee = await User.findById(assigned_to).select('_id');
        if (!assignee) return res.status(400).json({ success: false, message: 'Assigned user not found' });

        const created = await Task.create({
            title, description, assigned_to, assigned_by,
            priority: priority || 'medium', due_date
        });

        const task = await Task.findById(created._id).populate(POP);

        // Fire notification (non-blocking)
        const io = req.app.get('io');
        notify(io, {
            userId: assigned_to,
            type: 'task',
            title: '📋 New Task Assigned',
            message: `"${task.title}" has been assigned to you by ${task.assigned_by.name}.`,
            relatedId: task._id.toString()
        });

        res.status(201).json({ success: true, message: 'Task created successfully', task: shapeTask(task) });
    } catch (error) {
        console.error('POST /tasks error:', error);
        res.status(500).json({ success: false, message: 'Failed to create task' });
    }
});

// ── PUT /api/tasks/:id ─────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, [
    body('title').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('due_date').optional().isDate()
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
        const existing = await Task.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Task not found' });

        if (req.user.role === 'employee') {
            if (existing.assigned_to.toString() !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            // Employees may ONLY update status — strict check
            const allowedFields = ["status"];
            const keys = Object.keys(req.body);
            const isValid = keys.every(key => allowedFields.includes(key));

            if (!isValid) {
                return res.status(403).json({
                    success: false,
                    message: "Employees can only update status"
                });
            }

            const { status } = req.body;
            if (!status) {
                return res.status(400).json({ success: false, message: 'Status is required to update a task' });
            }

            const updates = { status };
            if (status === 'completed') updates.completed_at = new Date();
            // If moving OUT of completed, clear the timestamp
            if (status !== 'completed' && existing.status === 'completed') updates.completed_at = null;

            const task = await Task.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).populate(POP);
            return res.json({ success: true, message: 'Task status updated successfully', task: shapeTask(task) });
        }

        // Admin — all fields
        const { title, description, status, priority, due_date, assigned_to } = req.body;
        const updates = {};

        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (priority !== undefined) updates.priority = priority;
        if (due_date !== undefined) updates.due_date = due_date;
        if (assigned_to !== undefined) updates.assigned_to = assigned_to;
        if (status !== undefined) {
            updates.status = status;
            if (status === 'completed') updates.completed_at = new Date();
            if (status !== 'completed' && existing.status === 'completed') updates.completed_at = null;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const task = await Task.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).populate(POP);
        res.json({ success: true, message: 'Task updated successfully', task: shapeTask(task) });
    } catch (error) {
        console.error('PUT /tasks/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to update task' });
    }
});

// ── DELETE /api/tasks/:id ──────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    try {
        const result = await Task.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Task not found' });
        res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
        console.error('DELETE /tasks error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete task' });
    }
});

module.exports = router;
