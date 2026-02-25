'use strict';

const express = require('express');
const router = express.Router();
const Standup = require('../models/Standup');
const Task = require('../models/Task');
const User = require('../models/User');
const { authenticateToken, isAdmin } = require('../middleware/auth');

/* ─────────────────────────────────────────────────────────────
   Helper: today's date string in IST  YYYY-MM-DD
───────────────────────────────────────────────────────────── */
function todayIST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'YYYY-MM-DD'
}

/* ─────────────────────────────────────────────────────────────
   Helper: given a user's standups & tasks → dynamic perf metrics
───────────────────────────────────────────────────────────── */
const PRIORITY_WEIGHT = { low: 1, medium: 2, high: 3, urgent: 3 };

function calcStandupPerformance(userId, standups, tasks) {
    // ------- daily metrics (today's standup) -------
    const today = todayIST();
    const todayStandup = standups.find(s => s.date === today);
    const totalTasksPlanned = todayStandup ? todayStandup.todayTasks.length : 0;
    const totalEstimatedHours = todayStandup
        ? todayStandup.todayTasks.reduce((s, t) => s + t.estimatedHours, 0)
        : 0;

    // ------- yesterday's completion ratio -------
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const yesterdayStandup = standups.find(s => s.date === yesterday);
    const yesterdayPlanned = yesterdayStandup ? yesterdayStandup.todayTasks.length : 0;

    // count tasks that were actually completed yesterday (by completedAt date)
    const completedYesterday = tasks.filter(t => {
        if (t.status !== 'completed' || !t.completed_at) return false;
        const ca = new Date(t.completed_at);
        return ca.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === yesterday;
    }).length;

    const completionRatio = yesterdayPlanned > 0
        ? parseFloat((completedYesterday / yesterdayPlanned).toFixed(2))
        : null;

    // ------- weekly score (from task performance logic) -------
    const completedTasks = tasks.filter(t => t.status === 'completed');
    let totalPointsEarned = 0;
    let lateCount = 0;
    completedTasks.forEach(t => {
        const weight = PRIORITY_WEIGHT[t.priority] || 1;
        totalPointsEarned += weight;
        if (t.completed_at && t.due_date) {
            const completedAt = new Date(t.completed_at);
            const dueDate = new Date(t.due_date);
            if (!isNaN(completedAt) && !isNaN(dueDate) && completedAt > dueDate) {
                lateCount++;
            }
        }
    });
    const weeklyScore = Math.max(0, totalPointsEarned - lateCount * 2);

    return { totalTasksPlanned, totalEstimatedHours, completedYesterday, completionRatio, weeklyScore, lateTasks: lateCount };
}

/* ─────────────────────────────────────────────────────────────
   POST /api/standup  — submit today's standup (employee)
───────────────────────────────────────────────────────────── */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const today = todayIST();

        // Duplicate guard
        const existing = await Standup.findOne({ userId: req.user.id, date: today });
        if (existing) {
            return res.status(409).json({ success: false, message: 'You have already submitted your standup for today.' });
        }

        const { yesterdayWork, todayTasks, blockers } = req.body;

        // Validation
        if (!yesterdayWork || !yesterdayWork.trim()) {
            return res.status(400).json({ success: false, message: 'Please describe what you did yesterday.' });
        }
        if (!Array.isArray(todayTasks) || todayTasks.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one task for today is required.' });
        }
        for (const task of todayTasks) {
            if (!task.title || !task.title.trim()) {
                return res.status(400).json({ success: false, message: 'Each task must have a title.' });
            }
            if (
                typeof task.estimatedHours !== "number" ||
                task.estimatedHours <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Estimated hours must be greater than 0"
                });
            }
        }

        const standup = new Standup({
            userId: req.user.id,
            date: today,
            yesterdayWork: yesterdayWork.trim(),
            todayTasks,
            blockers: blockers ? blockers.trim() : '',
            submittedAt: new Date()
        });

        await standup.save();
        res.status(201).json({ success: true, message: 'Standup submitted successfully!', standup });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'You have already submitted your standup for today.' });
        }
        console.error('POST /standup error:', err);
        res.status(500).json({ success: false, message: 'Server error while submitting standup.' });
    }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/standup/today  — check if user already submitted today
───────────────────────────────────────────────────────────── */
router.get('/today', authenticateToken, async (req, res) => {
    try {
        const today = todayIST();
        const standup = await Standup.findOne({ userId: req.user.id, date: today }).lean();
        res.json({ success: true, submitted: !!standup, standup: standup || null });
    } catch (err) {
        console.error('GET /standup/today error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/standup/my  — current user's standup history
───────────────────────────────────────────────────────────── */
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const standups = await Standup.find({ userId: req.user.id })
            .sort({ date: -1 })
            .limit(30)
            .lean();
        res.json({ success: true, standups });
    } catch (err) {
        console.error('GET /standup/my error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/standup/performance  — own dynamic performance
───────────────────────────────────────────────────────────── */
router.get('/performance', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const standups = await Standup.find({ userId }).lean();
        const tasks = await Task.find({ assigned_to: userId }).lean();
        const metrics = calcStandupPerformance(userId, standups, tasks);
        res.json({ success: true, performance: metrics });
    } catch (err) {
        console.error('GET /standup/performance error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/standup  — admin: all standups for a given date
   Query: ?date=YYYY-MM-DD  (defaults to today)
───────────────────────────────────────────────────────────── */
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const date = req.query.date || todayIST();
        const standups = await Standup.find({ date })
            .populate('userId', 'name email department')
            .lean();

        const totalEmployees = await User.countDocuments({ role: 'employee', status: 'active' });
        const submittedCount = standups.length;
        const missingCount = Math.max(0, totalEmployees - submittedCount);
        const totalBlockers = standups.filter(s => s.blockers && s.blockers.trim()).length;
        const highWorkload = standups.filter(s =>
            s.todayTasks.reduce((sum, t) => sum + t.estimatedHours, 0) > 8
        ).map(s => ({ name: s.userId?.name, email: s.userId?.email }));

        res.json({
            success: true,
            date,
            totalEmployees,
            submittedCount,
            missingCount,
            totalBlockers,
            highWorkloadEmployees: highWorkload,
            standups
        });
    } catch (err) {
        console.error('GET /standup (admin) error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/standup/summary  — admin: today's summary object only
───────────────────────────────────────────────────────────── */
router.get('/summary', authenticateToken, isAdmin, async (req, res) => {
    try {
        const date = req.query.date || todayIST();
        const standups = await Standup.find({ date }).lean();
        const totalEmployees = await User.countDocuments({ role: 'employee', status: 'active' });

        const summary = {
            date,
            totalEmployees,
            submittedCount: standups.length,
            missingCount: Math.max(0, totalEmployees - standups.length),
            totalBlockers: standups.filter(s => s.blockers && s.blockers.trim()).length,
            highWorkloadEmployees: standups
                .filter(s => s.todayTasks.reduce((sum, t) => sum + t.estimatedHours, 0) > 8)
                .length
        };
        res.json({ success: true, summary });
    } catch (err) {
        console.error('GET /standup/summary error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

const { sendRemindersToMissing } = require('../utils/standupCron');

/* ─────────────────────────────────────────────────────────────
   POST /api/standup/remind-missing — manual reminder trigger (admin)
───────────────────────────────────────────────────────────── */
router.post('/remind-missing', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await sendRemindersToMissing();
        if (result.success) {
            res.json({ success: true, message: `Reminders sent to ${result.count} employee(s).` });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send reminders', error: result.error });
        }
    } catch (err) {
        console.error('POST /standup/remind-missing error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
