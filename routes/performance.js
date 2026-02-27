'use strict';

const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// ── Priority weight map ───────────────────────────────────────────────────────
const PRIORITY_WEIGHT = { low: 1, medium: 2, high: 3, urgent: 3 };

/**
 * Calculate performance metrics for a single employee given their tasks.
 * No data is stored — everything is computed on-the-fly.
 */
function calcMetrics(user, tasks) {
    const totalTasksAssigned = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const totalTasksCompleted = completedTasks.length;

    // Late task = completed AFTER its due_date
    let lateTasks = 0;
    let totalPointsEarned = 0;
    let latePointPenalty = 0;

    completedTasks.forEach(t => {
        const weight = PRIORITY_WEIGHT[t.priority] || 1;
        totalPointsEarned += weight;

        // Check lateness only when both dates are available
        if (t.completed_at && t.due_date) {
            const completedAt = new Date(t.completed_at);
            const dueDate = new Date(t.due_date);
            if (!isNaN(completedAt) && !isNaN(dueDate) && completedAt > dueDate) {
                lateTasks++;
                latePointPenalty += 2;
            }
        }
    });

    // Weekly performance score formula (from spec)
    const rawScore = totalPointsEarned - latePointPenalty;

    // Normalise to 0-100 scale:
    //   max possible points = totalTasksAssigned × 3 (all high priority)
    const maxPossible = totalTasksAssigned * 3;
    let performanceScore = 0;
    if (maxPossible > 0) {
        performanceScore = parseFloat(Math.max(0, (rawScore / maxPossible) * 100).toFixed(2));
    }

    // Completion rate as percentage (0-100)
    const completionRate = totalTasksAssigned > 0
        ? parseFloat(((totalTasksCompleted / totalTasksAssigned) * 100).toFixed(2))
        : 0;

    return {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        totalTasksAssigned,
        totalTasksCompleted,
        lateTasks,
        totalPointsEarned,
        performanceScore,
        completionRate
    };
}

// ── GET /api/performance ──────────────────────────────────────────────────────
// Admin  → all employees' performance
// Employee → own performance only
router.get('/', authenticateToken, async (req, res) => {
    try {
        const perms = req.user.permissions || [];
        const isHrAdmin = perms.includes('VIEW_ALL_ATTENDANCE') || req.user.role === 'admin';
        const isHr = perms.includes('VIEW_ALL_REPORTS') && !isHrAdmin;
        const isManager = perms.includes('VIEW_TEAM_PERFORMANCE') && !isHrAdmin && !isHr;

        if (isHrAdmin || isHr || isManager) {
            const filterUsers = {};
            if (isHr) {
                if (req.user.department_ref) filterUsers.department_ref = req.user.department_ref;
                else return res.status(403).json({ success: false, message: 'HR department not configured' });
            } else if (isManager) {
                filterUsers.reports_to = req.user.id;
            }

            // Fetch employees in scope
            const employees = await User.find({
                ...filterUsers,
                role: { $ne: 'admin' }
            }).select('_id name email').lean();

            // Optimization: Filter tasks by date range if provided
            const { start_date, end_date } = req.query;
            const taskFilter = {};
            if (start_date) taskFilter.createdAt = { $gte: new Date(start_date) };
            if (end_date) taskFilter.createdAt = { $lte: new Date(end_date) };

            // Fetch tasks and group by assigned_to
            const allTasks = await Task.find(taskFilter).lean();
            const tasksByUser = {};
            allTasks.forEach(t => {
                if (t.assigned_to) {
                    const uid = t.assigned_to.toString();
                    if (!tasksByUser[uid]) tasksByUser[uid] = [];
                    tasksByUser[uid].push(t);
                }
            });

            const performance = employees.map(emp =>
                calcMetrics(emp, tasksByUser[emp._id.toString()] || [])
            );

            return res.json({ success: true, performance });
        }

        // Employee — own data only
        const user = await User.findById(req.user.id).select('_id name email').lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const tasks = await Task.find({ assigned_to: req.user.id }).lean();
        const performance = calcMetrics(user, tasks);

        return res.json({ success: true, performance });

    } catch (error) {
        console.error('GET /performance error:', error);
        res.status(500).json({ success: false, message: 'Failed to calculate performance' });
    }
});

module.exports = router;
