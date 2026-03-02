'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { getPermissionsForRoles } = require('../config/permissions');

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', [
    body('email').trim().toLowerCase(), // Issue 4: Only trim and lowercase
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // Issue 4: Exact match query
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({ success: false, message: 'Account is inactive' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // ── Auto-Sync Permissions on Login ────────────────────────────────────
        const combinedRoles = [...(user.roles || [])];
        if (user.role && !combinedRoles.includes(user.role)) {
            combinedRoles.push(user.role);
        }
        const freshPerms = getPermissionsForRoles(combinedRoles);

        // If permissions field is missing or different, update and save
        if (!user.permissions || user.permissions.length !== freshPerms.length) {
            user.permissions = freshPerms;
            // We'll save with refresh token below
        }

        // Issue 2: Token Expiry Handling
        const payload = {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            roles: user.roles || [],
            permissions: user.permissions || []
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' }); // Short expiry (15m)
        const refreshToken = jwt.sign(
            { id: user._id.toString() },
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
            { expiresIn: '7d' } // Longer expiry (7d)
        );

        // Store refresh token
        user.refresh_token = refreshToken;
        await user.save();

        res.json({
            success: true,
            message: 'Login successful',
            token,
            refreshToken,
            requirePasswordChange: user.is_temp_password === true, // Issue 3
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                roles: user.roles || [],
                permissions: user.permissions || [],
                department: user.department,
                position: user.position
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token required' });

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || user.refresh_token !== refreshToken) {
            return res.status(403).json({ success: false, message: 'Invalid refresh token' });
        }

        const payload = {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            roles: user.roles || [],
            permissions: user.permissions || []
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
        res.json({ success: true, token });
    } catch (err) {
        console.error('Refresh token error:', err.message);
        res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
    }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('name email role roles permissions department position phone status');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // ── Fresh Permission Sync on /me ─────────────────────────────────────
        const combinedRoles = [...(user.roles || [])];
        if (user.role && !combinedRoles.includes(user.role)) {
            combinedRoles.push(user.role);
        }
        const freshPerms = getPermissionsForRoles(combinedRoles);
        if (!user.permissions || user.permissions.length !== freshPerms.length) {
            user.permissions = freshPerms;
            await user.save();
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error('/me error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
router.put('/change-password', authenticateToken, [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.is_temp_password = false; // Issue 3
        await user.save();

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
