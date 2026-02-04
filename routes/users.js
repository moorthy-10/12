const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all users (Admin only)
router.get('/', authenticateToken, isAdmin, (req, res) => {
    const { search, role, status, department } = req.query;

    let query = 'SELECT id, name, email, role, department, position, phone, status, created_at FROM users WHERE 1=1';
    const params = [];

    if (search) {
        query += ' AND (name LIKE ? OR email LIKE ? OR department LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    if (role) {
        query += ' AND role = ?';
        params.push(role);
    }

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    if (department) {
        query += ' AND department = ?';
        params.push(department);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, users) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, users });
    });
});

// Get single user
router.get('/:id', authenticateToken, (req, res) => {
    // Users can view their own profile, admins can view anyone
    if (req.user.role !== 'admin' && req.user.id != req.params.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    db.get('SELECT id, name, email, role, department, position, phone, status, created_at FROM users WHERE id = ?',
        [req.params.id],
        (err, user) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            res.json({ success: true, user });
        }
    );
});

// Create user (Admin only)
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
        // Check if email already exists
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
            if (err) {
                console.error('❌ Database error while checking existing user:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email already exists' });
            }

            // Generate secure temporary password
            const temporaryPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
            console.log('🔐 Generated temporary password for user:', email);

            // Hash password before storing
            const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
            console.log('🔒 Password hashed successfully');

            // Create user in database
            db.run(`
                INSERT INTO users (name, email, password, role, department, position, phone)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [name, email, hashedPassword, role, department, position, phone], function (err) {
                if (err) {
                    console.error('❌ Database error while creating user:', err);
                    return res.status(500).json({ success: false, message: 'Failed to create user' });
                }

                const userId = this.lastID;
                console.log('✅ User created successfully in database - ID:', userId);

                // Fetch created user
                db.get('SELECT id, name, email, role, department, position, phone, status FROM users WHERE id = ?',
                    [userId],
                    async (err, user) => {
                        if (err) {
                            console.error('❌ Failed to fetch created user:', err);
                            return res.status(500).json({ success: false, message: 'User created but failed to fetch' });
                        }

                        // Trigger n8n webhook for email notification
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
                            await axios.post(webhookUrl, {
                                name,
                                email,
                                role,
                                temporaryPassword
                            }, {
                                timeout: 5000,
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            });

                            console.log('✅ n8n webhook triggered successfully - Email notification sent');
                            res.status(201).json({
                                success: true,
                                message: 'User created successfully and email notification sent',
                                user
                            });

                        } catch (webhookError) {
                            console.error('⚠️ n8n webhook failed:', webhookError.message);
                            if (webhookError.response) {
                                console.error('   Response status:', webhookError.response.status);
                                console.error('   Response data:', webhookError.response.data);
                            }

                            // User creation succeeded, only email failed
                            res.status(201).json({
                                success: true,
                                message: 'User created successfully but email notification failed',
                                warning: 'Please notify the user manually',
                                user
                            });
                        }
                    }
                );
            });
        });
    } catch (error) {
        console.error('❌ Server error during user creation:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update user (Admin only)
router.put('/:id', authenticateToken, isAdmin, [
    body('name').optional().notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'employee']),
    body('status').optional().isIn(['active', 'inactive'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, role, department, position, phone, status } = req.body;
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (email) { updates.push('email = ?'); params.push(email); }
    if (role) { updates.push('role = ?'); params.push(role); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department); }
    if (position !== undefined) { updates.push('position = ?'); params.push(position); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (status) { updates.push('status = ?'); params.push(status); }

    if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, params, function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to update user' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        db.get('SELECT id, name, email, role, department, position, phone, status FROM users WHERE id = ?',
            [req.params.id],
            (err, user) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'User updated but failed to fetch' });
                }
                res.json({ success: true, message: 'User updated successfully', user });
            }
        );
    });
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
    // Prevent deleting yourself
    if (req.user.id == req.params.id) {
        return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to delete user' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully' });
    });
});

module.exports = router;
