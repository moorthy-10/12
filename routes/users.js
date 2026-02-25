'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authenticateToken, isAdmin } = require('../middleware/auth');


// ── GET /api/users ─────────────────────────────────────────────────────────────
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { search, role, status, department } = req.query;
        const filter = {};

        if (search) {
            const re = new RegExp(search, 'i');
            filter.$or = [{ name: re }, { email: re }, { department: re }];
        }
        if (role) filter.role = role;
        if (status) filter.status = status;
        if (department) filter.department = department;

        const users = await User.find(filter)
            .select('name email role department position phone status createdAt')
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
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    try {
        const user = await User.findById(req.params.id)
            .select('name email role department position phone status createdAt');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user });
    } catch (error) {
        console.error('GET /users/:id error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── POST /api/users ────────────────────────────────────────────────────────────
router.post('/', authenticateToken, isAdmin, [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('role').isIn(['admin', 'employee'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, role, department, position, phone } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        const temporaryPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
        console.log('🔐 Generated temporary password for user:', email);
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        console.log('🔒 Password hashed successfully');

        const created = await User.create({
            name, email, password: hashedPassword,
            role, department, position, phone
        });
        console.log('✅ User created successfully in database - ID:', created._id);

        const user = {
            id: created._id.toString(),
            name: created.name, email: created.email,
            role: created.role, department: created.department,
            position: created.position, phone: created.phone,
            status: created.status
        };

        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        if (!webhookUrl) {
            console.warn('⚠️ N8N_WEBHOOK_URL not configured - skipping email notification');
            return res.status(201).json({
                success: true,
                message: 'User created successfully (email notification disabled)',
                user
            });
        }

        console.log('📧 Triggering n8n webhook for email notification...');
        try {
            await axios.post(webhookUrl, { name, email, role, temporaryPassword }, {
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' }
            });
            console.log('✅ n8n webhook triggered successfully - Email notification sent');
            return res.status(201).json({
                success: true,
                message: 'User created successfully and email notification sent',
                user
            });
        } catch (webhookError) {
            console.error('⚠️ n8n webhook failed:', webhookError.message);
            return res.status(201).json({
                success: true,
                message: 'User created successfully but email notification failed',
                warning: 'Please notify the user manually',
                user
            });
        }
    } catch (error) {
        console.error('❌ Server error during user creation:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── PUT /api/users/:id ─────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, isAdmin, [
    body('name').optional().notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'employee']),
    body('status').optional().isIn(['active', 'inactive'])
], async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, role, department, position, phone, status } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (department !== undefined) updates.department = department;
    if (position !== undefined) updates.position = position;
    if (phone !== undefined) updates.phone = phone;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('name email role department position phone status');

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.json({ success: true, message: 'User updated successfully', user });
    } catch (error) {
        console.error('PUT /users/:id error:', error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
});

// ── DELETE /api/users/:id ──────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
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
router.post('/fcm-token', authenticateToken, [
    body('fcmToken').isString().notEmpty().withMessage('FCM token must be a string')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        await User.findByIdAndUpdate(req.user.id, {
            fcmToken: req.body.fcmToken
        });
        res.json({ success: true, message: 'FCM token updated successfully' });
    } catch (error) {
        console.error('POST /fcm-token error:', error);
        res.status(500).json({ success: false, message: 'Failed to update FCM token' });
    }
});

module.exports = router;
