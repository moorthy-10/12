'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const axios = require('axios');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authenticateToken, isAdmin } = require('../middleware/auth');


/**
 * Generate a secure random password
 */
function generateSecurePassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)];

    for (let i = password.length; i < length; i++) {
        const randomIndex = crypto.randomInt(0, charset.length);
        password += charset[randomIndex];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
}

// ── POST /api/admin/create-user ───────────────────────────────────────────────
router.post('/create-user', authenticateToken, isAdmin, [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { name, email } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'A user with this email already exists' });
        }

        const temporaryPassword = generateSecurePassword();
        console.log(`🔐 Generated temporary password for user: ${email}`);

        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        console.log('🔒 Password hashed successfully');

        const created = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'employee',
            status: 'active',
            forcePasswordChange: true
        });

        console.log(`✅ User created successfully in database - ID: ${created._id}`);

        const newUser = {
            id: created._id.toString(),
            name: created.name,
            email: created.email,
            role: created.role,
            status: created.status,
            createdAt: created.createdAt
        };

        // n8n webhook (best-effort)
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (!n8nWebhookUrl) {
            console.warn('⚠️ N8N_WEBHOOK_URL not configured - skipping email notification');
            return res.status(201).json({
                success: true,
                message: 'User created successfully',
                user: newUser,
                temporaryPassword,
                warning: 'Email notifications not configured'
            });
        }

        console.log('📧 Triggering n8n webhook for email notification...');
        try {
            await axios.post(n8nWebhookUrl, { name, email, role: 'employee', temporaryPassword }, {
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' }
            });
            console.log(`✅ n8n webhook triggered successfully - Email notification sent for ${email}`);
            return res.status(201).json({
                success: true,
                message: 'User created successfully and credentials sent via email',
                user: newUser,
                temporaryPassword
            });
        } catch (webhookError) {
            console.error('⚠️ n8n webhook failed:', webhookError.message);
            return res.status(201).json({
                success: true,
                message: 'User created successfully (email notification failed — share password manually)',
                user: newUser,
                temporaryPassword,
                warning: 'Please share the temporary password below with the user directly'
            });
        }
    } catch (error) {
        console.error('❌ Error creating user:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create user. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ── POST /api/admin/reset-password/:id ───────────────────────────────────────
router.post('/reset-password/:id', authenticateToken, isAdmin, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format"
        });
    }

    if (req.params.id === req.user.id) {
        return res.status(400).json({ success: false, message: 'Use change-password to update your own password' });
    }

    try {
        const user = await User.findById(req.params.id).select('name email role');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newPassword = generateSecurePassword();
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        user.forcePasswordChange = true;
        await user.save();

        console.log(`🔑 Password reset by admin for user: ${user.email}`);

        return res.json({
            success: true,
            message: `Password reset successfully for ${user.name}`,
            temporaryPassword: newPassword,
            user: { id: user._id.toString(), name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('❌ Reset password error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
});

module.exports = router;
