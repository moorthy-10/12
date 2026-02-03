const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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
    body('password').isLength({ min: 6 }),
    body('role').isIn(['admin', 'employee'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role, department, position, phone } = req.body;

    try {
        // Check if email already exists
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            db.run(`
        INSERT INTO users (name, email, password, role, department, position, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [name, email, hashedPassword, role, department, position, phone], function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Failed to create user' });
                }

                db.get('SELECT id, name, email, role, department, position, phone, status FROM users WHERE id = ?',
                    [this.lastID],
                    (err, user) => {
                        if (err) {
                            return res.status(500).json({ success: false, message: 'User created but failed to fetch' });
                        }
                        res.status(201).json({ success: true, message: 'User created successfully', user });
                    }
                );
            });
        });
    } catch (error) {
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
