const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const axios = require('axios');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

/**
 * Generate a secure random password
 * @returns {string} A secure 12-character password
 */
function generateSecurePassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        const randomIndex = crypto.randomInt(0, charset.length);
        password += charset[randomIndex];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * POST /api/admin/create-user
 * Create a new employee user and trigger n8n webhook to send credentials
 * Admin only endpoint
 */
router.post('/create-user', authenticateToken, isAdmin, [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }

    const { name, email } = req.body;

    try {
        // Check if email already exists
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists'
            });
        }

        // Generate a secure temporary password
        const temporaryPassword = generateSecurePassword();
        console.log(`🔐 Generated temporary password for user: ${email}`);

        // Hash the password using bcrypt
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        console.log('🔒 Password hashed successfully');

        // Save the user in the database FIRST (user creation must never fail due to email issues)
        const newUser = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO users (name, email, password, role, status, forcePasswordChange)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [name, email, hashedPassword, 'employee', 'active', 1], function (err) {
                if (err) {
                    console.error('❌ Database error while creating user:', err);
                    reject(err);
                } else {
                    const userId = this.lastID;
                    console.log(`✅ User created successfully in database - ID: ${userId}`);

                    // Fetch the created user
                    db.get(
                        'SELECT id, name, email, role, status, created_at FROM users WHERE id = ?',
                        [userId],
                        (err, user) => {
                            if (err) {
                                console.error('❌ Failed to fetch created user:', err);
                                reject(err);
                            } else {
                                resolve(user);
                            }
                        }
                    );
                }
            });
        });

        // User is now created ✅ - email notification is best-effort from here

        // Check if n8n webhook URL is configured
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

        if (!n8nWebhookUrl) {
            console.warn('⚠️ N8N_WEBHOOK_URL not configured - skipping email notification');
            return res.status(201).json({
                success: true,
                message: 'User created successfully (email notification disabled)',
                user: newUser,
                warning: 'Email notifications not configured'
            });
        }

        // Trigger n8n webhook with the credentials
        console.log('📧 Triggering n8n webhook for email notification...');

        try {
            await axios.post(
                n8nWebhookUrl,
                {
                    name,
                    email,
                    role: 'employee',
                    temporaryPassword
                },
                {
                    timeout: 5000, // 5 seconds as specified
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ n8n webhook triggered successfully - Email notification sent for ${email}`);

            // Success response - user created and email sent
            return res.status(201).json({
                success: true,
                message: 'User created successfully and credentials have been sent via email',
                user: newUser
            });

        } catch (webhookError) {
            // Log the error internally but DON'T throw it
            console.error('⚠️ n8n webhook failed:', webhookError.message);
            if (webhookError.response) {
                console.error('   Response status:', webhookError.response.status);
                console.error('   Response data:', webhookError.response.data);
            } else if (webhookError.code) {
                console.error('   Error code:', webhookError.code);
            }

            // User was created successfully - only email notification failed
            return res.status(201).json({
                success: true,
                message: 'User created successfully but email notification failed',
                user: newUser,
                warning: 'Please send credentials manually to the user'
            });
        }



    } catch (error) {
        // This catch is ONLY for database errors (user creation failure)
        console.error('❌ Error creating user:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create user. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
