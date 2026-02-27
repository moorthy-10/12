'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authenticateToken, isAdmin, authorize } = require('../middleware/auth');


// ── GET /api/users ─────────────────────────────────────────────────────────────
router.get('/', authenticateToken, authorize(['MANAGE_EMPLOYEES']), async (req, res) => {
    try {
        const { search, role, status, department_id } = req.query;
        const filter = {};

        const perms = req.user.permissions || [];
        const isHrAdmin = perms.includes('ASSIGN_ROLES') || req.user.role === 'admin';
        const isHr = perms.includes('VIEW_ALL_REPORTS') && !isHrAdmin;
        const isManager = perms.includes('VIEW_TEAM_ATTENDANCE') && !isHrAdmin && !isHr;

        if (isHrAdmin) {
            // Access all
        } else if (isHr) {
            // HR Scope: Only their department
            const deptId = req.user.department_ref;
            if (deptId) {
                filter.$or = [{ department_ref: deptId }];
            } else {
                return res.status(403).json({ success: false, message: 'HR department not configured' });
            }
        } else if (isManager) {
            // Manager Scope: Only direct reports
            filter.reports_to = req.user.id;
        } else {
            return res.status(403).json({ success: false, message: 'Insufficient permission to list users' });
        }

        if (search) {
            const re = new RegExp(search, 'i');
            filter.$and = filter.$and || [];
            filter.$and.push({ $or: [{ name: re }, { email: re }, { position: re }] });
        }
        if (role) filter.role = role;
        if (status) filter.status = status;
        if (department_id) filter.department_ref = department_id;

        const users = await User.find(filter)
            .select('name email role roles department department_ref position phone status reports_to employment_type createdAt')
            .populate('department_ref', 'name')
            .populate('reports_to', 'name')
            .sort({ createdAt: -1 });

        res.json({ success: true, users });
    } catch (error) {
        console.error('GET /users error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── GET /api/users/:id ─────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    try {
        const user = await User.findById(req.params.id)
            .select('name email role roles department department_ref position phone reports_to employment_type status createdAt')
            .populate('department_ref', 'name')
            .populate('reports_to', 'name');

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Scope Enforcement for Individual user view
        const perms = req.user.permissions || [];
        const isHrAdmin = perms.includes('ASSIGN_ROLES') || req.user.role === 'admin';

        if (!isHrAdmin && req.user.id !== req.params.id) {
            const isHr = perms.includes('VIEW_ALL_REPORTS');
            const isManager = perms.includes('VIEW_TEAM_ATTENDANCE');

            if (isHr) {
                const sameDept = req.user.department_ref?.toString() === user.department_ref?._id?.toString();
                if (!sameDept) return res.status(403).json({ success: false, message: 'Access denied (Different Department)' });
            } else if (isManager) {
                const isReport = user.reports_to?._id?.toString() === req.user.id;
                if (!isReport) return res.status(403).json({ success: false, message: 'Access denied (Not a Direct Report)' });
            } else {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error('GET /users/:id error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── POST /api/users ────────────────────────────────────────────────────────────
router.post('/', authenticateToken, authorize(['MANAGE_EMPLOYEES']), [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('roles').optional().isArray()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, role, roles, department, department_ref, position, phone, reports_to, employment_type } = req.body;

    // Only HR Admin / Admin can assign special roles
    const userPerms = req.user.permissions || [];
    if ((roles || role) && !userPerms.includes('ASSIGN_ROLES') && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Insufficient permission to assign roles' });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: 'Email already exists' });

        const temporaryPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        const created = await User.create({
            name, email, password: hashedPassword,
            role: role || 'employee',
            roles: roles || [role || 'employee'],
            department,
            department_ref,
            position,
            phone,
            reports_to,
            employment_type: employment_type || 'fulltime'
        });

        const user = await User.findById(created._id).select('-password');

        // n8n webhook logic... (omitted for brevity but preserved in real file)
        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        if (webhookUrl) {
            axios.post(webhookUrl, { name, email, role: created.role, temporaryPassword }).catch(err => console.error('n8n fail:', err.message));
        }

        res.status(201).json({ success: true, message: 'User created successfully', user });
    } catch (error) {
        console.error('POST /users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── PUT /api/users/:id ─────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, authorize(['MANAGE_EMPLOYEES']), [
    body('name').optional().notEmpty().trim(),
    body('email').optional().isEmail()
], async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, role, roles, department, department_ref, position, phone, status, reports_to, employment_type } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (department !== undefined) updates.department = department;
    if (department_ref !== undefined) updates.department_ref = department_ref === "" ? null : department_ref;
    if (position !== undefined) updates.position = position;
    if (phone !== undefined) updates.phone = phone;
    if (status !== undefined) updates.status = status;
    if (reports_to !== undefined) updates.reports_to = reports_to === "" ? null : reports_to;
    if (employment_type !== undefined) updates.employment_type = employment_type;

    // Role updates require ASSIGN_ROLES
    if (role !== undefined || roles !== undefined) {
        const userPerms = req.user.permissions || [];
        if (!userPerms.includes('ASSIGN_ROLES') && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Insufficient permission to update roles' });
        }
        if (role !== undefined) updates.role = role;
        if (roles !== undefined) updates.roles = roles;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('name email role roles department department_ref position phone status reports_to employment_type');

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.json({ success: true, message: 'User updated successfully', user });
    } catch (error) {
        console.error('PUT /users/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
});

// ── DELETE /api/users/:id ──────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, authorize(['MANAGE_EMPLOYEES']), async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
    }
    if (req.user.id === req.params.id) {
        return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    try {
        const result = await User.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('DELETE /users/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

// ── POST /api/users/fcm-token ────────────────────────────────────────────────
router.post('/fcm-token', authenticateToken, async (req, res) => {
    try {
        const { fcmToken, registrationError } = req.body;

        // Handle registration error reported by mobile client
        if (registrationError) {
            console.warn(`[FCM] Client registration error for user ${req.user.id}:`, registrationError);
            return res.json({ success: true, message: 'Token error logged safely' });
        }

        if (!fcmToken) {
            return res.json({ success: true, message: 'No token provided, nothing to update' });
        }

        await User.findByIdAndUpdate(req.user.id, { fcmToken });
        res.json({ success: true, message: 'FCM token updated successfully' });
    } catch (error) {
        console.error('[PushFail] FCM token update error:', error.message);
        // Never return 500 for token refreshes to avoid breaking mobile app flow
        res.json({ success: false, message: 'Handled token update error safely' });
    }
});

module.exports = router;
